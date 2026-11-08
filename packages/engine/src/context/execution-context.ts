import type { StepContext, StructuredLogger } from "../definitions/types";

export interface CreateExecutionContextOptions<TWorkflowInput = unknown> {
  readonly tenantId: string;
  readonly workflowId: string;
  readonly runId: string;
  readonly stepId: string;
  readonly attempt: number;
  readonly signal: AbortSignal;
  readonly workflowInput: TWorkflowInput;
  readonly stepOutputs: ReadonlyMap<string, unknown>;
  readonly previousStepId?: string | undefined;
  readonly logger: StructuredLogger;
}

export class WorkflowExecutionContext<TWorkflowInput = unknown> implements StepContext<TWorkflowInput> {
  readonly tenantId: string;
  readonly workflowId: string;
  readonly runId: string;
  readonly stepId: string;
  readonly attempt: number;
  readonly signal: AbortSignal;
  readonly idempotencyKey: string;
  readonly workflowInput: TWorkflowInput;
  readonly previousOutput: unknown;
  readonly logger: StructuredLogger;

  private readonly _stepOutputs: ReadonlyMap<string, unknown>;

  constructor(options: CreateExecutionContextOptions<TWorkflowInput>) {
    this.tenantId = options.tenantId;
    this.workflowId = options.workflowId;
    this.runId = options.runId;
    this.stepId = options.stepId;
    this.attempt = options.attempt;
    this.signal = options.signal;
    this.workflowInput = options.workflowInput;
    this._stepOutputs = options.stepOutputs;
    this.logger = options.logger;

    this.idempotencyKey = `${options.tenantId}:${options.workflowId}:${options.runId}:${options.stepId}:${options.attempt}`;
    this.previousOutput = options.previousStepId
      ? options.stepOutputs.get(options.previousStepId)
      : undefined;
  }

  getStepOutput<T = unknown>(stepId: string): T | undefined {
    return this._stepOutputs.get(stepId) as T | undefined;
  }
}
