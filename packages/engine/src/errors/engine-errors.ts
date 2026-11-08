export class EngineError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EngineError";
  }
}

export class WorkflowValidationError extends EngineError {
  public readonly issues: readonly string[];

  constructor(message: string, issues: readonly string[] = []) {
    super(message);
    this.name = "WorkflowValidationError";
    this.issues = issues;
  }
}

export class InvalidStateTransitionError extends EngineError {
  public readonly fromState: string;
  public readonly toState: string;
  public readonly entityType: "run" | "step";

  constructor(entityType: "run" | "step", fromState: string, toState: string) {
    super(`Cannot transition ${entityType} from "${fromState}" to "${toState}"`);
    this.name = "InvalidStateTransitionError";
    this.entityType = entityType;
    this.fromState = fromState;
    this.toState = toState;
  }
}

export class StepExecutionError extends EngineError {
  public readonly stepId: string;
  public readonly attempt: number;
  public readonly causeError: unknown;

  constructor(stepId: string, attempt: number, cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`Step "${stepId}" failed on attempt ${attempt}: ${msg}`, {
      cause: cause instanceof Error ? cause : undefined,
    });
    this.name = "StepExecutionError";
    this.stepId = stepId;
    this.attempt = attempt;
    this.causeError = cause;
  }
}

export class StepTimeoutError extends EngineError {
  public readonly stepId: string;
  public readonly timeoutMs: number;

  constructor(stepId: string, timeoutMs: number) {
    super(`Step "${stepId}" timed out after ${timeoutMs}ms`);
    this.name = "StepTimeoutError";
    this.stepId = stepId;
    this.timeoutMs = timeoutMs;
  }
}

export class WorkflowCancelledError extends EngineError {
  public readonly runId: string;
  public readonly stepId: string | undefined;

  constructor(runId: string, stepId?: string | undefined) {
    super(
      stepId
        ? `Workflow run "${runId}" step "${stepId}" was cancelled`
        : `Workflow run "${runId}" was cancelled`
    );
    this.name = "WorkflowCancelledError";
    this.runId = runId;
    this.stepId = stepId;
  }
}
