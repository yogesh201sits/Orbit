import type {
  IWorkflowRunRepository,
  IWorkflowStepRepository,
  IWorkflowEventRepository,
  WorkflowRunRecord,
  Json,
} from "@durable/storage";
import type {
  WorkflowDefinition,
  StepDefinition,
  DynamicStepContext,
  DynamicStepOptions,
  WorkflowExecutionContextInfo,
} from "../definitions/types";
import { StepExecutor, serializeError } from "./step-executor";
import { RecoveryManager } from "../recovery/recovery-manager";
import { DefaultStructuredLogger, type LogSink } from "../context/logger";
import {
  assertValidRunTransition,
  isTerminalRunStatus,
} from "./state-machine";
import {
  EngineError,
  WorkflowCancelledError,
} from "../errors/engine-errors";

export interface ExecutionEngineOptions {
  readonly runRepo: IWorkflowRunRepository;
  readonly stepRepo: IWorkflowStepRepository;
  readonly eventRepo?: IWorkflowEventRepository | undefined;
  readonly logSink?: LogSink | undefined;
  readonly sleepFn?: ((ms: number, signal?: AbortSignal) => Promise<void>) | undefined;
}

export interface StartWorkflowOptions<TWorkflowInput = unknown> {
  readonly tenantId: string;
  readonly workflowId: string;
  readonly versionId: string;
  readonly workflow: WorkflowDefinition<TWorkflowInput, any>;
  readonly input?: TWorkflowInput | undefined;
  readonly runId?: string | undefined;
}

export interface WorkflowExecutionResult {
  readonly runId: string;
  readonly status: "COMPLETED" | "FAILED" | "CANCELLED";
  readonly output?: unknown;
  readonly error?: unknown;
}

function parseDurationMs(d: string | number): number {
  if (typeof d === "number") return d;
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i.exec(d.trim());
  if (!match) return Number(d) || 0;
  const val = parseFloat(match[1]!);
  const unit = (match[2] ?? "ms").toLowerCase();
  switch (unit) {
    case "d": return val * 86_400_000;
    case "h": return val * 3_600_000;
    case "m": return val * 60_000;
    case "s": return val * 1_000;
    case "ms": default: return val;
  }
}

export class ExecutionEngine {
  private readonly runRepo: IWorkflowRunRepository;
  private readonly stepRepo: IWorkflowStepRepository;
  private readonly eventRepo?: IWorkflowEventRepository | undefined;
  private readonly stepExecutor: StepExecutor;
  private readonly recoveryManager: RecoveryManager;
  private readonly logSink?: LogSink | undefined;

  // Active runs controller map for cancellation
  private readonly activeControllers = new Map<string, AbortController>();

  constructor(options: ExecutionEngineOptions) {
    this.runRepo = options.runRepo;
    this.stepRepo = options.stepRepo;
    this.eventRepo = options.eventRepo;
    this.logSink = options.logSink;
    this.stepExecutor = new StepExecutor(
      options.stepRepo,
      options.eventRepo,
      options.sleepFn
    );
    this.recoveryManager = new RecoveryManager(
      options.runRepo,
      options.stepRepo,
      options.eventRepo
    );
  }

  private runKey(tenantId: string, runId: string): string {
    return `${tenantId}:${runId}`;
  }

  /**
   * Starts a new workflow run.
   */
  async start<TWorkflowInput = unknown>(
    options: StartWorkflowOptions<TWorkflowInput>
  ): Promise<WorkflowExecutionResult> {
    const { tenantId, workflowId, versionId, workflow, input } = options;

    // 1. Create run in persistence
    const createdRun = await this.runRepo.create({
      tenantId,
      workflowId,
      versionId,
      input: (input as any) ?? undefined,
    });

    return this.executeRun(tenantId, workflowId, createdRun, workflow, input);
  }

  /**
   * Resumes an existing workflow run from where it was interrupted.
   */
  async resume<TWorkflowInput = unknown>(
    tenantId: string,
    runId: string,
    workflow: WorkflowDefinition<TWorkflowInput, any>
  ): Promise<WorkflowExecutionResult> {
    const recoveryState = await this.recoveryManager.inspectRun(tenantId, runId);
    const { run } = recoveryState;

    if (recoveryState.isAlreadyTerminal) {
      return {
        runId: run.id,
        status: run.status as "COMPLETED" | "FAILED" | "CANCELLED",
        output: run.output,
        error: run.error,
      };
    }

    return this.executeRun(
      tenantId,
      run.workflowId,
      run,
      workflow,
      run.input as TWorkflowInput,
      recoveryState.completedStepOutputs
    );
  }

  /**
   * Cancels an active or pending workflow run.
   */
  async cancel(tenantId: string, runId: string): Promise<WorkflowRunRecord> {
    const key = this.runKey(tenantId, runId);
    const controller = this.activeControllers.get(key);
    if (controller) {
      controller.abort(new WorkflowCancelledError(runId));
    }

    const run = await this.runRepo.findById(tenantId, runId);
    if (!run) {
      throw new EngineError(`Workflow run "${runId}" not found for tenant "${tenantId}"`);
    }

    if (isTerminalRunStatus(run.status)) {
      return run;
    }

    assertValidRunTransition(run.status, "CANCELLED");

    const updated = await this.runRepo.update(
      tenantId,
      runId,
      {
        status: "CANCELLED",
        completedAt: new Date(),
      },
      run.revision
    );

    if (this.eventRepo) {
      await this.eventRepo.create({
        runId,
        type: "run.cancelled",
        payload: { cancelledAt: new Date() } as unknown as Json,
      });
    }

    return updated;
  }

  private async executeRun<TWorkflowInput = unknown>(
    tenantId: string,
    workflowId: string,
    run: WorkflowRunRecord,
    workflow: WorkflowDefinition<TWorkflowInput, any>,
    workflowInput?: TWorkflowInput | undefined,
    initialOutputs?: Map<string, unknown> | undefined
  ): Promise<WorkflowExecutionResult> {
    const runId = run.id;
    const key = this.runKey(tenantId, runId);

    const controller = new AbortController();
    this.activeControllers.set(key, controller);

    const logger = new DefaultStructuredLogger(
      { tenantId, runId },
      this.logSink
    );

    let currentRevision = run.revision;

    try {
      // Transition run status to RUNNING if it is PENDING or FAILED
      if (run.status === "PENDING" || run.status === "FAILED") {
        assertValidRunTransition(run.status, "RUNNING");
        const updated = await this.runRepo.update(
          tenantId,
          runId,
          {
            status: "RUNNING",
            startedAt: run.startedAt ?? new Date(),
          },
          currentRevision
        );
        currentRevision = updated.revision;

        if (this.eventRepo) {
          await this.eventRepo.create({
            runId,
            type: run.status === "PENDING" ? "run.started" : "run.resumed",
            payload: { workflowName: workflow.name, version: workflow.version } as unknown as Json,
          });
        }
      }

      // Output tracking
      const stepOutputs = initialOutputs ?? new Map<string, unknown>();
      let previousStepId: string | undefined = undefined;

      // Find last completed step if resuming
      if (initialOutputs && initialOutputs.size > 0 && workflow.steps) {
        for (const step of workflow.steps) {
          if (stepOutputs.has(step.id)) {
            previousStepId = step.id;
          }
        }
      }

      let lastStepOutput: unknown = undefined;

      if (typeof workflow.handler === "function") {
        const dynamicStep: DynamicStepContext = {
          run: async <T>(
            stepId: string,
            callback: () => Promise<T> | T,
            options?: DynamicStepOptions
          ): Promise<T> => {
            if (controller.signal.aborted) {
              throw new WorkflowCancelledError(runId, stepId);
            }

            let timeoutMs = options?.timeoutMs;
            if (timeoutMs === undefined && options?.timeout !== undefined) {
              timeoutMs = parseDurationMs(options.timeout);
            }

            let retryPolicy = options?.retry;
            if (!retryPolicy && options?.retries !== undefined) {
              retryPolicy = { maxAttempts: options.retries + 1 };
            }

            const dynamicStepDef: StepDefinition<TWorkflowInput, T> = {
              id: stepId,
              type: options?.type ?? "action",
              retry: retryPolicy,
              timeoutMs,
              metadata: options?.metadata,
              execute: async () => callback(),
            };

            const result = await this.stepExecutor.executeStep({
              tenantId,
              workflowId,
              runId,
              step: dynamicStepDef,
              stepOutputs,
              workflowInput: workflowInput as TWorkflowInput,
              previousStepId,
              cancellationSignal: controller.signal,
              stepRepo: this.stepRepo,
              eventRepo: this.eventRepo,
              logger: logger.child({ stepId, attempt: 1 }),
            });

            stepOutputs.set(stepId, result.output);
            previousStepId = stepId;
            return result.output as T;
          },
        };

        const executionInfo: WorkflowExecutionContextInfo = {
          tenantId,
          workflowId,
          runId,
          signal: controller.signal,
          logger,
        };

        lastStepOutput = await workflow.handler({
          input: workflowInput as TWorkflowInput,
          step: dynamicStep,
          context: executionInfo,
        });
      } else if (workflow.steps && workflow.steps.length > 0) {
        // Execute each step sequentially
        for (const step of workflow.steps) {
          if (controller.signal.aborted) {
            throw new WorkflowCancelledError(runId, step.id);
          }

          const result = await this.stepExecutor.executeStep({
            tenantId,
            workflowId,
            runId,
            step,
            stepOutputs,
            workflowInput: workflowInput as TWorkflowInput,
            previousStepId,
            cancellationSignal: controller.signal,
            stepRepo: this.stepRepo,
            eventRepo: this.eventRepo,
            logger: logger.child({ stepId: step.id, attempt: 1 }),
          });

          stepOutputs.set(step.id, result.output);
          previousStepId = step.id;
          lastStepOutput = result.output;
        }
      }

      // Mark run COMPLETED
      assertValidRunTransition("RUNNING", "COMPLETED");
      await this.runRepo.update(
        tenantId,
        runId,
        {
          status: "COMPLETED",
          output: (lastStepOutput as any) ?? null,
          completedAt: new Date(),
        },
        currentRevision
      );

      if (this.eventRepo) {
        await this.eventRepo.create({
          runId,
          type: "run.completed",
          payload: { output: lastStepOutput ?? null } as unknown as Json,
        });
      }

      return {
        runId,
        status: "COMPLETED",
        output: lastStepOutput,
      };
    } catch (err) {
      if (
        err instanceof WorkflowCancelledError ||
        controller.signal.aborted
      ) {
        // Run cancelled
        try {
          const freshRun = await this.runRepo.findById(tenantId, runId);
          if (freshRun && !isTerminalRunStatus(freshRun.status)) {
            await this.runRepo.update(
              tenantId,
              runId,
              {
                status: "CANCELLED",
                completedAt: new Date(),
              },
              freshRun.revision
            );
          }
        } catch {
          // Ignore stale revision error if cancel() already transitioned it
        }

        return {
          runId,
          status: "CANCELLED",
          error: serializeError(err),
        };
      }

      // Run failed
      try {
        const freshRun = await this.runRepo.findById(tenantId, runId);
        if (freshRun && !isTerminalRunStatus(freshRun.status)) {
          await this.runRepo.update(
            tenantId,
            runId,
            {
              status: "FAILED",
              error: serializeError(err),
              completedAt: new Date(),
            },
            freshRun.revision
          );
        }
      } catch {
        // Fallback
      }

      if (this.eventRepo) {
        await this.eventRepo.create({
          runId,
          type: "run.failed",
          payload: { error: serializeError(err) } as unknown as Json,
        });
      }

      return {
        runId,
        status: "FAILED",
        error: serializeError(err),
      };
    } finally {
      this.activeControllers.delete(key);
    }
  }
}
