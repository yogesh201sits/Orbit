export class WorkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LeaseLostError extends WorkerError {
  constructor(
    public readonly jobId: string,
    public readonly workerId: string,
    public readonly expectedFencingToken?: bigint,
    message?: string
  ) {
    super(
      message ??
        `Worker "${workerId}" lost lease for job "${jobId}" (fencing token: ${expectedFencingToken?.toString() ?? "unknown"}). Aborting execution.`
    );
  }
}

export class FencingTokenMismatchError extends WorkerError {
  constructor(
    public readonly jobId: string,
    public readonly expectedToken: bigint,
    public readonly actualToken?: bigint
  ) {
    super(
      `Fencing token mismatch for job "${jobId}": expected ${expectedToken}, got ${actualToken?.toString() ?? "unknown"}`
    );
  }
}

export class WorkerShutdownError extends WorkerError {
  constructor(
    public readonly workerId: string,
    message?: string
  ) {
    super(message ?? `Worker "${workerId}" is shutting down or stopped`);
  }
}

export class InvalidJobPayloadError extends WorkerError {
  constructor(
    public readonly jobId: string,
    public readonly reason: string
  ) {
    super(`Invalid payload for job "${jobId}": ${reason}`);
  }
}

export class WorkflowNotFoundError extends WorkerError {
  constructor(
    public readonly identifier: string,
    public readonly tenantId: string
  ) {
    super(
      `Workflow "${identifier}" not found or not registered for tenant "${tenantId}"`
    );
  }
}

export class WorkerRegistrationError extends WorkerError {
  constructor(
    public readonly workerId: string,
    public readonly tenantId: string,
    cause?: unknown
  ) {
    super(
      `Failed to register worker "${workerId}" for tenant "${tenantId}": ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    );
    if (cause) {
      this.cause = cause;
    }
  }
}

export class StaleWorkerError extends WorkerError {
  constructor(
    public readonly workerId: string,
    public readonly lastHeartbeat: Date | null,
    public readonly thresholdMs: number
  ) {
    super(
      `Worker "${workerId}" has not sent a heartbeat since ${lastHeartbeat?.toISOString() ?? "never"} (threshold: ${thresholdMs}ms)`
    );
  }
}

export class DatabaseHeartbeatError extends WorkerError {
  constructor(
    public readonly workerId: string,
    cause?: unknown
  ) {
    super(
      `Heartbeat database update failed for worker "${workerId}": ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    );
    if (cause) {
      this.cause = cause;
    }
  }
}
