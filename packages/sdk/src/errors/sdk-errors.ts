export class OrbitSDKError extends Error {
  readonly code: string;
  readonly statusCode?: number | undefined;
  readonly details?: unknown;

  constructor(
    message: string,
    options?: {
      code?: string | undefined;
      statusCode?: number | undefined;
      details?: unknown;
      cause?: unknown;
    }
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.code = options?.code ?? "ORBIT_SDK_ERROR";
    this.statusCode = options?.statusCode;
    this.details = options?.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigurationError extends OrbitSDKError {
  constructor(message: string, details?: unknown) {
    super(message, { code: "CONFIGURATION_ERROR", details });
  }
}

export class AuthenticationError extends OrbitSDKError {
  constructor(message: string = "Authentication failed: invalid or missing API key", details?: unknown) {
    super(message, { code: "AUTHENTICATION_ERROR", statusCode: 401, details });
  }
}

export class AuthorizationError extends OrbitSDKError {
  constructor(message: string = "Authorization failed: insufficient permissions", details?: unknown) {
    super(message, { code: "AUTHORIZATION_ERROR", statusCode: 403, details });
  }
}

export class ValidationError extends OrbitSDKError {
  readonly validationIssues?: string[] | undefined;

  constructor(message: string, issues?: string[]) {
    super(message, { code: "VALIDATION_ERROR", statusCode: 400, details: issues });
    this.validationIssues = issues;
  }
}

export class WorkflowNotFoundError extends OrbitSDKError {
  readonly workflowId: string;

  constructor(workflowId: string) {
    super(`Workflow "${workflowId}" not found`, {
      code: "WORKFLOW_NOT_FOUND",
      statusCode: 404,
      details: { workflowId },
    });
    this.workflowId = workflowId;
  }
}

export class WorkflowVersionError extends OrbitSDKError {
  readonly workflowId: string;
  readonly version?: number | undefined;

  constructor(workflowId: string, version?: number, message?: string) {
    const msg = message ?? (version !== undefined
      ? `Workflow "${workflowId}" version ${version} is not registered or supported`
      : `No active version found for workflow "${workflowId}"`);
    super(msg, {
      code: "WORKFLOW_VERSION_ERROR",
      statusCode: 404,
      details: { workflowId, version },
    });
    this.workflowId = workflowId;
    this.version = version;
  }
}

export class RunNotFoundError extends OrbitSDKError {
  readonly runId: string;

  constructor(runId: string) {
    super(`Workflow run "${runId}" not found`, {
      code: "RUN_NOT_FOUND",
      statusCode: 404,
      details: { runId },
    });
    this.runId = runId;
  }
}

export class StepExecutionError extends OrbitSDKError {
  readonly stepId: string;
  readonly attempt: number;

  constructor(stepId: string, attempt: number, cause?: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`Step "${stepId}" failed on attempt ${attempt}: ${msg}`, {
      code: "STEP_EXECUTION_ERROR",
      cause,
      details: { stepId, attempt },
    });
    this.stepId = stepId;
    this.attempt = attempt;
  }
}

export class StepTimeoutError extends OrbitSDKError {
  readonly stepId: string;
  readonly timeoutMs: number;

  constructor(stepId: string, timeoutMs: number) {
    super(`Step "${stepId}" timed out after ${timeoutMs}ms`, {
      code: "STEP_TIMEOUT",
      details: { stepId, timeoutMs },
    });
    this.stepId = stepId;
    this.timeoutMs = timeoutMs;
  }
}

export class StepCancelledError extends OrbitSDKError {
  readonly stepId?: string | undefined;

  constructor(stepId?: string) {
    super(stepId ? `Step "${stepId}" was cancelled` : "Step execution was cancelled", {
      code: "STEP_CANCELLED",
      details: { stepId },
    });
    this.stepId = stepId;
  }
}

export class RequestTimeoutError extends OrbitSDKError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, url?: string) {
    super(`HTTP request timed out after ${timeoutMs}ms${url ? ` (${url})` : ""}`, {
      code: "REQUEST_TIMEOUT",
      statusCode: 408,
      details: { timeoutMs, url },
    });
    this.timeoutMs = timeoutMs;
  }
}

export class NetworkError extends OrbitSDKError {
  constructor(message: string, cause?: unknown) {
    super(`Network request failed: ${message}`, {
      code: "NETWORK_ERROR",
      cause,
    });
  }
}

export class RateLimitError extends OrbitSDKError {
  readonly retryAfterMs?: number | undefined;

  constructor(message: string = "Rate limit exceeded", retryAfterMs?: number) {
    super(message, {
      code: "RATE_LIMIT_EXCEEDED",
      statusCode: 429,
      details: { retryAfterMs },
    });
    this.retryAfterMs = retryAfterMs;
  }
}

export class IdempotencyConflictError extends OrbitSDKError {
  readonly idempotencyKey: string;

  constructor(idempotencyKey: string, message?: string) {
    super(message ?? `A run with idempotency key "${idempotencyKey}" already exists with conflicting parameters`, {
      code: "IDEMPOTENCY_CONFLICT",
      statusCode: 409,
      details: { idempotencyKey },
    });
    this.idempotencyKey = idempotencyKey;
  }
}
