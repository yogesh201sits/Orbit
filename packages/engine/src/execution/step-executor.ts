import type {
  IWorkflowStepRepository,
  IWorkflowEventRepository,
  Json,
} from "@durable/storage";
import type { StepDefinition, StepContext, StructuredLogger } from "../definitions/types";
import { resolveRetryPolicy, calculateBackoffDelay, isRetryableError } from "../retry/backoff";
import { WorkflowExecutionContext } from "../context/execution-context";
import {
  StepExecutionError,
  StepTimeoutError,
  WorkflowCancelledError,
} from "../errors/engine-errors";

export interface ExecuteStepParams<TWorkflowInput = unknown> {
  readonly tenantId: string;
  readonly workflowId: string;
  readonly runId: string;
  readonly step: StepDefinition<TWorkflowInput, any>;
  readonly stepOutputs: ReadonlyMap<string, unknown>;
  readonly workflowInput: TWorkflowInput;
  readonly previousStepId?: string | undefined;
  readonly cancellationSignal: AbortSignal;
  readonly stepRepo: IWorkflowStepRepository;
  readonly eventRepo?: IWorkflowEventRepository | undefined;
  readonly logger: StructuredLogger;
  /** Optional delay function hook for testing */
  readonly sleepFn?: ((ms: number, signal?: AbortSignal) => Promise<void>) | undefined;
}

export interface StepExecutionResult {
  readonly status: "COMPLETED" | "SKIPPED" | "CANCELLED";
  readonly output: unknown;
  readonly skipped: boolean;
  readonly attempt: number;
}

export function serializeError(err: unknown): Json {
  if (err instanceof Error) {
    const obj: Record<string, string | null> = {
      name: err.name,
      message: err.message,
    };
    if (err.stack) {
      obj["stack"] = err.stack;
    }
    return obj;
  }
  return { message: String(err) };
}

async function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (signal?.aborted) {
    throw new WorkflowCancelledError("cancelled during retry sleep");
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(new WorkflowCancelledError("cancelled during retry sleep"));
    };

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export class StepExecutor {
  private readonly stepRepo: IWorkflowStepRepository;
  private readonly eventRepo?: IWorkflowEventRepository | undefined;
  private readonly sleepFn: (ms: number, signal?: AbortSignal) => Promise<void>;

  constructor(
    stepRepo: IWorkflowStepRepository,
    eventRepo?: IWorkflowEventRepository | undefined,
    sleepFn: (ms: number, signal?: AbortSignal) => Promise<void> = defaultSleep
  ) {
    this.stepRepo = stepRepo;
    this.eventRepo = eventRepo;
    this.sleepFn = sleepFn;
  }

  async executeStep<TWorkflowInput = unknown>(
    params: ExecuteStepParams<TWorkflowInput>
  ): Promise<StepExecutionResult> {
    const {
      tenantId,
      workflowId,
      runId,
      step,
      stepOutputs,
      workflowInput,
      previousStepId,
      cancellationSignal,
      logger,
    } = params;

    // Check cancellation before anything starts
    if (cancellationSignal.aborted) {
      throw new WorkflowCancelledError(runId, step.id);
    }

    // 1. Check existing state in persistence
    let existingStep = await this.stepRepo.findByRunAndKey(runId, step.id);

    if (existingStep) {
      if (existingStep.status === "COMPLETED") {
        logger.info(`Step "${step.id}" is already completed; skipping execution`, {
          stepId: step.id,
        });
        return {
          status: "COMPLETED",
          output: existingStep.output,
          skipped: true,
          attempt: existingStep.attempt,
        };
      }

      if (existingStep.status === "SKIPPED") {
        return {
          status: "SKIPPED",
          output: existingStep.output,
          skipped: true,
          attempt: existingStep.attempt,
        };
      }

      if (existingStep.status === "CANCELLED") {
        throw new WorkflowCancelledError(runId, step.id);
      }
    } else {
      // Create new step record in storage
      existingStep = await this.stepRepo.create({
        runId,
        stepKey: step.id,
        type: step.type ?? "action",
        input: (workflowInput as any) ?? undefined,
      });
    }

    const policy = resolveRetryPolicy(step.retry);
    const startAttempt = existingStep.status === "RUNNING"
      ? existingStep.attempt // Crashed while running; safely re-run on this attempt
      : (existingStep.status === "FAILED" ? existingStep.attempt + 1 : 1);

    const maxAttempts = existingStep.status === "FAILED"
      ? existingStep.attempt + policy.maxAttempts
      : Math.max(policy.maxAttempts, startAttempt);

    let lastError: unknown = null;

    for (let attempt = startAttempt; attempt <= maxAttempts; attempt++) {
      if (cancellationSignal.aborted) {
        await this.stepRepo.update(existingStep.id, {
          status: "CANCELLED",
          completedAt: new Date(),
        });
        throw new WorkflowCancelledError(runId, step.id);
      }

      // Backoff sleep if this is a retry attempt
      if (attempt > startAttempt) {
        const delay = calculateBackoffDelay(attempt, policy);
        logger.info(`Retrying step "${step.id}" in ${delay}ms (attempt ${attempt}/${policy.maxAttempts})`, {
          stepId: step.id,
          attempt,
          delayMs: delay,
        });
        await this.sleepFn(delay, cancellationSignal);
      }

      // Mark step RUNNING in storage
      await this.stepRepo.update(existingStep.id, {
        status: "RUNNING",
        attempt,
        startedAt: new Date(),
      });

      if (this.eventRepo) {
        await this.eventRepo.create({
          runId,
          type: "step.started",
          payload: { stepId: step.id, attempt } as unknown as Json,
        });
      }

      // Setup timeout controller
      const timeoutController = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      if (step.timeoutMs && step.timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          timeoutController.abort(new StepTimeoutError(step.id, step.timeoutMs!));
        }, step.timeoutMs);
      }

      // Create linked abort signal combining cancellation and step timeout
      const combinedController = new AbortController();
      const onCancel = () => combinedController.abort(new WorkflowCancelledError(runId, step.id));
      const onTimeout = () =>
        combinedController.abort(
          timeoutController.signal.reason ?? new StepTimeoutError(step.id, step.timeoutMs!)
        );

      cancellationSignal.addEventListener("abort", onCancel, { once: true });
      timeoutController.signal.addEventListener("abort", onTimeout, { once: true });

      const ctx: StepContext<TWorkflowInput> = new WorkflowExecutionContext({
        tenantId,
        workflowId,
        runId,
        stepId: step.id,
        attempt,
        signal: combinedController.signal,
        workflowInput,
        stepOutputs,
        previousStepId,
        logger,
      });

      try {
        const output = await step.execute(ctx);

        if (timeoutId) clearTimeout(timeoutId);
        cancellationSignal.removeEventListener("abort", onCancel);
        timeoutController.signal.removeEventListener("abort", onTimeout);

        // Check if aborted before declaring success
        if (combinedController.signal.aborted) {
          throw combinedController.signal.reason;
        }

        // Persist successful step completion
        await this.stepRepo.update(existingStep.id, {
          status: "COMPLETED",
          output: (output as any) ?? null,
          completedAt: new Date(),
        });

        if (this.eventRepo) {
          await this.eventRepo.create({
            runId,
            type: "step.completed",
            payload: { stepId: step.id, attempt } as unknown as Json,
          });
        }

        return {
          status: "COMPLETED",
          output,
          skipped: false,
          attempt,
        };
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        cancellationSignal.removeEventListener("abort", onCancel);
        timeoutController.signal.removeEventListener("abort", onTimeout);

        lastError = err;

        // If cancelled
        if (
          err instanceof WorkflowCancelledError ||
          cancellationSignal.aborted ||
          (err instanceof Error && err.name === "AbortError" && cancellationSignal.aborted)
        ) {
          await this.stepRepo.update(existingStep.id, {
            status: "CANCELLED",
            completedAt: new Date(),
          });
          if (this.eventRepo) {
            await this.eventRepo.create({
              runId,
              type: "step.cancelled",
              payload: { stepId: step.id, attempt } as unknown as Json,
            });
          }
          throw new WorkflowCancelledError(runId, step.id);
        }

        // Check if timeout
        const isTimeout =
          err instanceof StepTimeoutError ||
          (combinedController.signal.aborted &&
            combinedController.signal.reason instanceof StepTimeoutError);

        const errorToPersist = isTimeout
          ? new StepTimeoutError(step.id, step.timeoutMs!)
          : err;

        lastError = errorToPersist;

        // Persist step failure
        await this.stepRepo.update(existingStep.id, {
          status: "FAILED",
          error: serializeError(errorToPersist),
          completedAt: new Date(),
        });

        if (this.eventRepo) {
          await this.eventRepo.create({
            runId,
            type: isTimeout ? "step.timed_out" : "step.failed",
            payload: {
              stepId: step.id,
              attempt,
              error: serializeError(errorToPersist),
            } as unknown as Json,
          });
        }

        // Check if retryable
        const canRetry = isRetryableError(errorToPersist, policy) && attempt < policy.maxAttempts;
        if (!canRetry) {
          if (isTimeout) {
            throw errorToPersist;
          }
          throw new StepExecutionError(step.id, attempt, err);
        }
      }
    }

    if (lastError instanceof StepTimeoutError) {
      throw lastError;
    }
    throw new StepExecutionError(step.id, policy.maxAttempts, lastError);
  }
}
