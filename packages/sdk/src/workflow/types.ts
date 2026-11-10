import { z } from "zod";
import type { DynamicStepOptions, RetryPolicy } from "@durable/engine";

export type DurationString =
  | `${number}ms`
  | `${number}s`
  | `${number}m`
  | `${number}h`
  | `${number}d`;

export type Duration = number | DurationString;

export interface StepRunOptions {
  /** Maximum number of retries if the step fails */
  readonly retries?: number | undefined;
  /** Custom retry policy configuration */
  readonly retry?: Partial<RetryPolicy> | undefined;
  /** Timeout in milliseconds or duration string e.g. "30s", "1m" */
  readonly timeout?: Duration | undefined;
  /** Step type identifier, defaults to "action" */
  readonly type?: string | undefined;
  /** Arbitrary step metadata */
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface StepSleepOptions {
  /** Optional metadata */
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface WaitForEventOptions {
  /** Event name to listen for */
  readonly event: string;
  /** Maximum time to wait before timing out */
  readonly timeout?: Duration | undefined;
  /** Optional correlation key or filter criteria */
  readonly correlationKey?: string | undefined;
}

export interface EmitEventOptions {
  /** Correlation key for tracing */
  readonly correlationKey?: string | undefined;
  /** Additional event metadata */
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface ChildWorkflowOptions {
  /** Specific version of the child workflow */
  readonly version?: number | undefined;
  /** Timeout for child workflow execution */
  readonly timeout?: Duration | undefined;
  /** Idempotency key for child run creation */
  readonly idempotencyKey?: string | undefined;
}

export interface StepContext {
  /**
   * Executes a durable step.
   * If the step was already completed in an earlier attempt, returns the persisted output.
   */
  run<T>(
    id: string,
    callback: () => Promise<T> | T,
    options?: StepRunOptions | undefined
  ): Promise<T>;

  /**
   * Durably pauses workflow execution for the specified duration.
   * Does not hold a worker thread while waiting.
   */
  sleep(id: string, duration: Duration, options?: StepSleepOptions | undefined): Promise<void>;

  /**
   * Durably waits for an external event matching the criteria.
   */
  waitForEvent<T = unknown>(
    id: string,
    options: WaitForEventOptions
  ): Promise<T>;

  /**
   * Emits an event to Orbit event storage and outbox.
   */
  emit<T = unknown>(
    event: string,
    payload: T,
    options?: EmitEventOptions | undefined
  ): Promise<void>;

  /**
   * Executes multiple durable steps concurrently and returns a tuple of results.
   */
  parallel<T extends readonly (() => Promise<any>)[]>(
    tasks: [...T]
  ): Promise<{ [K in keyof T]: T[K] extends () => Promise<infer R> ? R : never }>;

  /**
   * Registers a durable compensation action to be executed if later steps fail.
   */
  compensate(
    id: string,
    callback: () => Promise<void> | void,
    options?: { retries?: number | undefined } | undefined
  ): void;

  /**
   * Invokes another registered workflow as a child workflow run.
   */
  child<TInput, TOutput>(
    id: string,
    workflow: OrbitWorkflow<TInput, TOutput> | string,
    input: TInput,
    options?: ChildWorkflowOptions | undefined
  ): Promise<TOutput>;
}

export interface WorkflowExecutionContext {
  readonly tenantId: string;
  readonly workflowId: string;
  readonly runId: string;
  readonly attempt: number;
  readonly signal: AbortSignal;
  /**
   * Stable deterministic idempotency key for external side effects:
   * `${tenantId}:${workflowId}:${runId}:${stepId}`
   */
  readonly idempotencyKey: string;
}

export interface WorkflowHandlerParams<TInput> {
  readonly input: TInput;
  readonly step: StepContext;
  readonly context: WorkflowExecutionContext;
}

export type WorkflowHandler<TInput, TOutput> = (
  params: WorkflowHandlerParams<TInput>
) => Promise<TOutput>;

export interface WorkflowOptions<
  TInput = unknown,
  TOutput = unknown,
  TInputSchema extends z.ZodType<TInput> = z.ZodType<TInput>,
  TOutputSchema extends z.ZodType<TOutput> = z.ZodType<TOutput>
> {
  /** Stable workflow identifier (e.g. "process-order") */
  readonly id: string;
  /** Positive integer workflow version */
  readonly version: number;
  /** Human-readable display name */
  readonly name?: string | undefined;
  /** Optional description */
  readonly description?: string | undefined;
  /** Optional Zod schema for input validation and TypeScript inference */
  readonly inputSchema?: TInputSchema | undefined;
  /** Optional Zod schema for output validation */
  readonly outputSchema?: TOutputSchema | undefined;
  /** Arbitrary workflow metadata */
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface OrbitWorkflow<TInput = any, TOutput = any> {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly description?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly inputSchema?: z.ZodType<TInput> | undefined;
  readonly outputSchema?: z.ZodType<TOutput> | undefined;
  readonly handler: WorkflowHandler<TInput, TOutput>;

  /**
   * Converts the SDK workflow to an engine-compatible WorkflowDefinition.
   */
  toEngineDefinition(): import("@durable/engine").WorkflowDefinition<TInput, any>;

  /**
   * Serializes the workflow metadata (safe for control plane registration, NO arbitrary JS code).
   */
  toMetadataPayload(): {
    key: string;
    name: string;
    metadata?: Record<string, unknown> | undefined;
    version: {
      version: number;
      definition: Record<string, unknown>;
      checksum?: string | undefined;
      isActive: boolean;
    };
  };
}
