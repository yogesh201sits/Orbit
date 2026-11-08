import type {
  IScheduleRepository,
  IJobRepository,
  WorkflowScheduleRecord,
  Json,
} from "@durable/storage";
import type {
  ScheduleOptions,
  RecurringScheduleOptions,
  RescheduleOptions,
  ScheduledExecutionRecord,
} from "./types";
import { validateCronExpression, getNextCronOccurrence } from "../recurrence/cron";
import {
  ScheduleNotFoundError,
  ScheduleCancelledError,
} from "../errors/scheduler-errors";

function toRecord(s: WorkflowScheduleRecord): ScheduledExecutionRecord {
  return {
    id: s.id,
    tenantId: s.tenantId,
    workflowId: s.workflowId,
    isRecurring: s.cronExpression !== null,
    status: s.status,
    nextRunAt: s.nextRunAt,
    cronExpression: s.cronExpression,
    timezone: s.timezone,
    input: s.input,
    missedExecutionPolicy: s.missedExecutionPolicy,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export class SchedulerClient {
  constructor(
    private readonly scheduleRepo: IScheduleRepository,
    private readonly jobRepo: IJobRepository
  ) {}

  /**
   * Schedules a one-time workflow execution (immediate, delayed, or at a specific date).
   */
  async schedule(options: ScheduleOptions): Promise<ScheduledExecutionRecord> {
    const { tenantId, workflowId, input, runAt, delayMs } = options;

    let targetRunAt: Date;
    if (runAt) {
      targetRunAt = runAt;
    } else if (delayMs !== undefined) {
      targetRunAt = new Date(Date.now() + delayMs);
    } else {
      // Immediate execution
      targetRunAt = new Date();
    }

    const schedule = await this.scheduleRepo.create({
      tenantId,
      workflowId,
      nextRunAt: targetRunAt,
      input: (input as unknown as Json) ?? undefined,
    });

    return toRecord(schedule);
  }

  /**
   * Schedules a recurring workflow execution using a cron expression.
   */
  async scheduleRecurring(options: RecurringScheduleOptions): Promise<ScheduledExecutionRecord> {
    const {
      tenantId,
      workflowId,
      cronExpression,
      timezone = "UTC",
      input,
      missedExecutionPolicy = "SKIP",
      startAt = new Date(),
    } = options;

    validateCronExpression(cronExpression, timezone);
    const nextRunAt = getNextCronOccurrence(cronExpression, startAt, timezone);

    const schedule = await this.scheduleRepo.create({
      tenantId,
      workflowId,
      cronExpression,
      timezone,
      input: (input as unknown as Json) ?? undefined,
      missedExecutionPolicy,
      nextRunAt,
    });

    return toRecord(schedule);
  }

  /**
   * Cancels a scheduled workflow execution.
   */
  async cancel(tenantId: string, scheduleId: string): Promise<ScheduledExecutionRecord> {
    const existing = await this.scheduleRepo.findById(tenantId, scheduleId);
    if (!existing) {
      throw new ScheduleNotFoundError(scheduleId);
    }

    const cancelled = await this.scheduleRepo.cancel(tenantId, scheduleId);
    return toRecord(cancelled);
  }

  /**
   * Reschedules an existing scheduled execution.
   */
  async reschedule(
    tenantId: string,
    scheduleId: string,
    options: RescheduleOptions
  ): Promise<ScheduledExecutionRecord> {
    const existing = await this.scheduleRepo.findById(tenantId, scheduleId);
    if (!existing) {
      throw new ScheduleNotFoundError(scheduleId);
    }

    if (existing.status === "CANCELLED") {
      throw new ScheduleCancelledError(scheduleId);
    }

    const timezone = options.timezone ?? existing.timezone;
    const cronExpression = options.cronExpression ?? existing.cronExpression;

    let nextRunAt: Date | undefined;

    if (options.runAt) {
      nextRunAt = options.runAt;
    } else if (options.delayMs !== undefined) {
      nextRunAt = new Date(Date.now() + options.delayMs);
    } else if (cronExpression) {
      validateCronExpression(cronExpression, timezone);
      nextRunAt = getNextCronOccurrence(cronExpression, new Date(), timezone);
    }

    const updated = await this.scheduleRepo.update(tenantId, scheduleId, {
      ...(cronExpression !== null ? { cronExpression } : {}),
      ...(options.timezone !== undefined ? { timezone: options.timezone } : {}),
      ...(options.input !== undefined ? { input: options.input as unknown as Json } : {}),
      ...(options.missedExecutionPolicy !== undefined ? { missedExecutionPolicy: options.missedExecutionPolicy } : {}),
      ...(nextRunAt !== undefined ? { nextRunAt } : {}),
    });

    return toRecord(updated);
  }

  /**
   * Retrieves an existing schedule by ID.
   */
  async getSchedule(
    tenantId: string,
    scheduleId: string
  ): Promise<ScheduledExecutionRecord | null> {
    const found = await this.scheduleRepo.findById(tenantId, scheduleId);
    return found ? toRecord(found) : null;
  }
}
