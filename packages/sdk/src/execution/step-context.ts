import { ValidationError, StepCancelledError } from "../errors/sdk-errors";
import type {
  StepContext,
  StepRunOptions,
  StepSleepOptions,
  WaitForEventOptions,
  EmitEventOptions,
  ChildWorkflowOptions,
  Duration,
  OrbitWorkflow,
} from "../workflow/types";
import { parseDuration } from "../primitives/duration";

export interface CreateStepContextOptions {
  readonly tenantId: string;
  readonly workflowId: string;
  readonly runId: string;
  readonly signal: AbortSignal;
  readonly engineStep: {
    run: (id: string, callback: () => Promise<any> | any, options?: any) => Promise<any>;
  };
  readonly logger?: any;
}

interface CompensationAction {
  id: string;
  callback: () => Promise<void> | void;
  retries?: number | undefined;
}

const STEP_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export class StepContextImpl implements StepContext {
  private readonly tenantId: string;
  private readonly workflowId: string;
  private readonly runId: string;
  private readonly signal: AbortSignal;
  private readonly engineStep: {
    run: (id: string, callback: () => Promise<any> | any, options?: any) => Promise<any>;
  };
  private readonly logger?: any;

  // Registered saga compensations (LIFO order)
  private readonly compensations: CompensationAction[] = [];

  constructor(options: CreateStepContextOptions) {
    this.tenantId = options.tenantId;
    this.workflowId = options.workflowId;
    this.runId = options.runId;
    this.signal = options.signal;
    this.engineStep = options.engineStep;
    this.logger = options.logger;
  }

  private validateStepId(id: string): void {
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      throw new ValidationError("Step ID cannot be empty");
    }
    if (!STEP_ID_REGEX.test(id)) {
      throw new ValidationError(
        `Invalid step ID "${id}". Step IDs must contain only alphanumeric characters, underscores, or dashes.`
      );
    }
  }

  /**
   * Deterministic external idempotency key:
   * `${tenantId}:${workflowId}:${runId}:${stepId}`
   */
  getIdempotencyKey(stepId: string): string {
    return `${this.tenantId}:${this.workflowId}:${this.runId}:${stepId}`;
  }

  async run<T>(
    id: string,
    callback: () => Promise<T> | T,
    options?: StepRunOptions
  ): Promise<T> {
    this.validateStepId(id);

    if (typeof callback !== "function") {
      throw new ValidationError(`Step "${id}" requires a callback function`);
    }

    if (this.signal.aborted) {
      throw new StepCancelledError(id);
    }

    let timeoutMs: number | undefined = undefined;
    if (options?.timeout !== undefined) {
      timeoutMs = parseDuration(options.timeout);
    }

    try {
      return await this.engineStep.run(
        id,
        async () => {
          return await callback();
        },
        {
          retries: options?.retries,
          retry: options?.retry,
          timeout: timeoutMs,
          type: options?.type ?? "action",
          metadata: {
            ...options?.metadata,
            idempotencyKey: this.getIdempotencyKey(id),
          },
        }
      );
    } catch (err) {
      // If run fails, execute registered saga compensations before rethrowing
      if (this.compensations.length > 0) {
        await this.runCompensations();
      }
      throw err;
    }
  }

  async sleep(id: string, duration: Duration, options?: StepSleepOptions): Promise<void> {
    this.validateStepId(id);
    const ms = parseDuration(duration);

    await this.engineStep.run(
      id,
      async () => {
        if (ms <= 0) return;
        if (this.signal.aborted) {
          throw new StepCancelledError(id);
        }

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            cleanup();
            resolve();
          }, ms);

          const onAbort = () => {
            cleanup();
            reject(new StepCancelledError(id));
          };

          const cleanup = () => {
            clearTimeout(timer);
            this.signal.removeEventListener("abort", onAbort);
          };

          this.signal.addEventListener("abort", onAbort, { once: true });
        });
      },
      {
        type: "sleep",
        metadata: {
          ...options?.metadata,
          durationMs: ms,
          wakeUpAt: new Date(Date.now() + ms).toISOString(),
        },
      }
    );
  }

  async waitForEvent<T = unknown>(id: string, options: WaitForEventOptions): Promise<T> {
    this.validateStepId(id);
    if (!options?.event || typeof options.event !== "string") {
      throw new ValidationError(`waitForEvent on step "${id}" requires an event name`);
    }

    const timeoutMs = options.timeout !== undefined ? parseDuration(options.timeout) : undefined;

    return await this.engineStep.run(
      id,
      async () => {
        // Event waiter persistence simulation or integration
        return {
          event: options.event,
          correlationKey: options.correlationKey,
          timestamp: new Date().toISOString(),
        } as unknown as T;
      },
      {
        type: "event.wait",
        timeout: timeoutMs,
        metadata: {
          event: options.event,
          correlationKey: options.correlationKey,
        },
      }
    );
  }

  async emit<T = unknown>(
    event: string,
    payload: T,
    options?: EmitEventOptions
  ): Promise<void> {
    const stepId = `emit-${event.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

    await this.engineStep.run(
      stepId,
      async () => {
        // Persist event emit safely inside durable step
        return {
          event,
          payload,
          correlationKey: options?.correlationKey,
          emittedAt: new Date().toISOString(),
        };
      },
      {
        type: "event.emit",
        metadata: {
          event,
          correlationKey: options?.correlationKey,
          ...options?.metadata,
        },
      }
    );
  }

  async parallel<T extends readonly (() => Promise<any>)[]>(
    tasks: [...T]
  ): Promise<{ [K in keyof T]: T[K] extends () => Promise<infer R> ? R : never }> {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return [] as any;
    }

    const results = await Promise.all(tasks.map((task) => task()));
    return results as any;
  }

  compensate(
    id: string,
    callback: () => Promise<void> | void,
    options?: { retries?: number | undefined }
  ): void {
    this.validateStepId(id);
    if (typeof callback !== "function") {
      throw new ValidationError(`Compensation "${id}" requires a callback function`);
    }
    // Add to stack for reverse-order (LIFO) execution
    this.compensations.push({ id, callback, retries: options?.retries });
  }

  async child<TInput, TOutput>(
    id: string,
    workflow: OrbitWorkflow<TInput, TOutput> | string,
    input: TInput,
    options?: ChildWorkflowOptions
  ): Promise<TOutput> {
    this.validateStepId(id);
    const childWorkflowId = typeof workflow === "string" ? workflow : workflow.id;

    const timeoutMs = options?.timeout !== undefined ? parseDuration(options.timeout) : undefined;
    const childIdempotencyKey =
      options?.idempotencyKey ?? `${this.runId}:${id}`;

    return await this.engineStep.run(
      id,
      async () => {
        // Child workflow invocation
        if (typeof workflow !== "string" && typeof workflow.toEngineDefinition === "function") {
          // If in-process workflow definition is available, we execute its handler
          const childStepContext = createStepContext({
            tenantId: this.tenantId,
            workflowId: childWorkflowId,
            runId: `${this.runId}_child_${id}`,
            signal: this.signal,
            engineStep: this.engineStep,
            logger: this.logger,
          });

          return await workflow.handler({
            input,
            step: childStepContext,
            context: {
              tenantId: this.tenantId,
              workflowId: childWorkflowId,
              runId: `${this.runId}_child_${id}`,
              attempt: 1,
              signal: this.signal,
              idempotencyKey: `${this.tenantId}:${childWorkflowId}:${this.runId}_child_${id}`,
            },
          });
        }

        return {
          childWorkflowId,
          childRunId: childIdempotencyKey,
          status: "COMPLETED",
          output: input,
        } as unknown as TOutput;
      },
      {
        type: "workflow.child",
        timeout: timeoutMs,
        metadata: {
          childWorkflowId,
          version: options?.version,
          idempotencyKey: childIdempotencyKey,
        },
      }
    );
  }

  private async runCompensations(): Promise<void> {
    // Pop and execute each registered compensation in reverse order
    while (this.compensations.length > 0) {
      const comp = this.compensations.pop()!;
      try {
        await comp.callback();
      } catch (compErr) {
        if (this.logger?.error) {
          this.logger.error(`Compensation "${comp.id}" failed: ${compErr}`);
        } else {
          console.error(`Compensation "${comp.id}" failed:`, compErr);
        }
      }
    }
  }
}

export function createStepContext(options: CreateStepContextOptions): StepContext {
  return new StepContextImpl(options);
}
