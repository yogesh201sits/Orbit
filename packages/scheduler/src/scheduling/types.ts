import type { MissedExecutionPolicy, ScheduleStatus } from "@durable/storage";

export interface ScheduleOptions {
  readonly tenantId: string;
  readonly workflowId: string;
  readonly input?: unknown;
  /** Schedule execution at a specific date/time */
  readonly runAt?: Date | undefined;
  /** Schedule execution after a delay in milliseconds */
  readonly delayMs?: number | undefined;
  /** Queue for worker dispatch (default: "default") */
  readonly queue?: string | undefined;
  readonly priority?: number | undefined;
}

export interface RecurringScheduleOptions {
  readonly tenantId: string;
  readonly workflowId: string;
  readonly cronExpression: string;
  readonly timezone?: string | undefined;
  readonly input?: unknown;
  readonly missedExecutionPolicy?: MissedExecutionPolicy | undefined;
  /** Optional initial anchor time. If omitted, calculated from cronExpression starting at now */
  readonly startAt?: Date | undefined;
}

export interface RescheduleOptions {
  readonly runAt?: Date | undefined;
  readonly delayMs?: number | undefined;
  readonly cronExpression?: string | undefined;
  readonly timezone?: string | undefined;
  readonly input?: unknown;
  readonly missedExecutionPolicy?: MissedExecutionPolicy | undefined;
}

export interface ScheduledExecutionRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly workflowId: string;
  readonly isRecurring: boolean;
  readonly status: ScheduleStatus;
  readonly nextRunAt: Date;
  readonly cronExpression: string | null;
  readonly timezone: string;
  readonly input: unknown;
  readonly missedExecutionPolicy: MissedExecutionPolicy;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
