export interface StructuredLogger {
  debug(message: string, meta?: Record<string, unknown> | undefined): void;
  info(message: string, meta?: Record<string, unknown> | undefined): void;
  warn(message: string, meta?: Record<string, unknown> | undefined): void;
  error(message: string, meta?: Record<string, unknown> | undefined): void;
}

export interface RetryPolicy {
  /** Maximum number of execution attempts (including the first one). Min: 1. */
  readonly maxAttempts: number;
  /** Initial delay before first retry in milliseconds. Min: 0. */
  readonly initialDelayMs: number;
  /** Multiplier for exponential backoff. Min: 1. */
  readonly backoffMultiplier: number;
  /** Maximum delay between retries in milliseconds. */
  readonly maxDelayMs: number;
  /** Whether to apply random jitter to the delay. */
  readonly jitter?: boolean | undefined;
  /** Optional custom classifier determining if an error is retryable. */
  readonly isRetryable?: ((error: unknown) => boolean) | undefined;
}

export interface StepContext<TWorkflowInput = unknown> {
  readonly tenantId: string;
  readonly workflowId: string;
  readonly runId: string;
  readonly stepId: string;
  readonly attempt: number;
  readonly signal: AbortSignal;
  /**
   * Deterministic idempotency token for external side-effects:
   * `${tenantId}:${workflowId}:${runId}:${stepId}:${attempt}`
   */
  readonly idempotencyKey: string;
  /** The workflow run's initial input */
  readonly workflowInput: TWorkflowInput;
  /** Output from the immediately preceding step (if any) */
  readonly previousOutput: unknown;
  /** Safely retrieve output of any previously completed step */
  getStepOutput<T = unknown>(stepId: string): T | undefined;
  /** Structured logging isolated to this run and step */
  readonly logger: StructuredLogger;
}

export interface StepDefinition<TWorkflowInput = any, TOutput = any> {
  readonly id: string;
  readonly type?: string | undefined;
  readonly retry?: Partial<RetryPolicy> | undefined;
  readonly timeoutMs?: number | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly execute: (ctx: StepContext<TWorkflowInput>) => Promise<TOutput> | TOutput;
}

export interface DynamicStepOptions {
  readonly retries?: number | undefined;
  readonly retry?: Partial<RetryPolicy> | undefined;
  readonly timeoutMs?: number | undefined;
  readonly timeout?: number | string | undefined;
  readonly type?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface DynamicStepContext {
  run<T>(
    stepId: string,
    callback: () => Promise<T> | T,
    options?: DynamicStepOptions | undefined
  ): Promise<T>;
}

export interface WorkflowExecutionContextInfo {
  readonly tenantId: string;
  readonly workflowId: string;
  readonly runId: string;
  readonly signal: AbortSignal;
  readonly logger: StructuredLogger;
}

export interface WorkflowHandlerContext<TWorkflowInput = any> {
  readonly input: TWorkflowInput;
  readonly step: DynamicStepContext;
  readonly context: WorkflowExecutionContextInfo;
}

export type WorkflowHandler<TWorkflowInput = any, TOutput = any> = (
  ctx: WorkflowHandlerContext<TWorkflowInput>
) => Promise<TOutput>;

export interface WorkflowDefinition<
  TWorkflowInput = any,
  TSteps extends readonly StepDefinition<any, any>[] = readonly StepDefinition<any, any>[]
> {
  readonly name: string;
  readonly version: number;
  readonly description?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly steps?: TSteps | undefined;
  readonly handler?: WorkflowHandler<TWorkflowInput, any> | undefined;
}
