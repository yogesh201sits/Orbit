export class SchedulerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SchedulerError";
  }
}

export class InvalidCronError extends SchedulerError {
  public readonly expression: string;

  constructor(expression: string, reason?: string) {
    super(
      reason
        ? `Invalid cron expression "${expression}": ${reason}`
        : `Invalid cron expression "${expression}"`
    );
    this.name = "InvalidCronError";
    this.expression = expression;
  }
}

export class ScheduleNotFoundError extends SchedulerError {
  public readonly scheduleId: string;

  constructor(scheduleId: string) {
    super(`Schedule not found: ${scheduleId}`);
    this.name = "ScheduleNotFoundError";
    this.scheduleId = scheduleId;
  }
}

export class ScheduleCancelledError extends SchedulerError {
  public readonly scheduleId: string;

  constructor(scheduleId: string) {
    super(`Schedule "${scheduleId}" is cancelled and cannot be scheduled`);
    this.name = "ScheduleCancelledError";
    this.scheduleId = scheduleId;
  }
}
