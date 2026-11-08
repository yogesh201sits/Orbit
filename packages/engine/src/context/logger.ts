import type { StructuredLogger } from "../definitions/types";

export interface LogEntry {
  readonly timestamp: Date;
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
  readonly tenantId: string;
  readonly runId: string;
  readonly stepId?: string | undefined;
  readonly attempt?: number | undefined;
  readonly meta?: Record<string, unknown> | undefined;
}

export type LogSink = (entry: LogEntry) => void;

export class DefaultStructuredLogger implements StructuredLogger {
  constructor(
    private readonly context: {
      tenantId: string;
      runId: string;
      stepId?: string | undefined;
      attempt?: number | undefined;
    },
    private readonly sink?: LogSink | undefined
  ) {}

  private log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    meta?: Record<string, unknown> | undefined
  ) {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      tenantId: this.context.tenantId,
      runId: this.context.runId,
      stepId: this.context.stepId,
      attempt: this.context.attempt,
      meta,
    };

    if (this.sink) {
      this.sink(entry);
    }
  }

  debug(message: string, meta?: Record<string, unknown> | undefined): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown> | undefined): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown> | undefined): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown> | undefined): void {
    this.log("error", message, meta);
  }

  child(stepContext: { stepId: string; attempt: number }): DefaultStructuredLogger {
    return new DefaultStructuredLogger(
      {
        tenantId: this.context.tenantId,
        runId: this.context.runId,
        stepId: stepContext.stepId,
        attempt: stepContext.attempt,
      },
      this.sink
    );
  }
}
