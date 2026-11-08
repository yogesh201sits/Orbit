import type {
  PrismaClient,
  IScheduleRepository,
  IJobRepository,
  IWorkflowRunRepository,
  IWorkflowVersionRepository,
} from "@durable/storage";
import { SchedulerClient } from "./scheduling/scheduler-client";
import { JobDispatcher } from "./dispatch/job-dispatcher";
import { DispatchLoop, type DispatchLoopOptions } from "./dispatch/dispatch-loop";
import type {
  ScheduleOptions,
  RecurringScheduleOptions,
  RescheduleOptions,
  ScheduledExecutionRecord,
} from "./scheduling/types";

export interface SchedulerOptions {
  readonly client: PrismaClient;
  readonly scheduleRepo: IScheduleRepository;
  readonly jobRepo: IJobRepository;
  readonly runRepo: IWorkflowRunRepository;
  readonly versionRepo?: IWorkflowVersionRepository | undefined;
  readonly schedulerId?: string | undefined;
  readonly pollIntervalMs?: number | undefined;
  readonly batchSize?: number | undefined;
  readonly leaseDurationMs?: number | undefined;
  readonly maxCatchUp?: number | undefined;
}

export class Scheduler {
  readonly client: SchedulerClient;
  readonly dispatcher: JobDispatcher;
  readonly loop: DispatchLoop;

  constructor(options: SchedulerOptions) {
    this.client = new SchedulerClient(options.scheduleRepo, options.jobRepo);
    this.dispatcher = new JobDispatcher(
      options.client,
      options.scheduleRepo,
      options.jobRepo,
      options.runRepo,
      options.versionRepo
    );
    this.loop = new DispatchLoop({
      schedulerId: options.schedulerId,
      scheduleRepo: options.scheduleRepo,
      dispatcher: this.dispatcher,
      pollIntervalMs: options.pollIntervalMs,
      batchSize: options.batchSize,
      leaseDurationMs: options.leaseDurationMs,
      maxCatchUp: options.maxCatchUp,
    });
  }

  // Scheduling API Delegation
  async schedule(options: ScheduleOptions): Promise<ScheduledExecutionRecord> {
    return this.client.schedule(options);
  }

  async scheduleRecurring(options: RecurringScheduleOptions): Promise<ScheduledExecutionRecord> {
    return this.client.scheduleRecurring(options);
  }

  async cancel(tenantId: string, scheduleId: string): Promise<ScheduledExecutionRecord> {
    return this.client.cancel(tenantId, scheduleId);
  }

  async reschedule(
    tenantId: string,
    scheduleId: string,
    options: RescheduleOptions
  ): Promise<ScheduledExecutionRecord> {
    return this.client.reschedule(tenantId, scheduleId, options);
  }

  async getSchedule(
    tenantId: string,
    scheduleId: string
  ): Promise<ScheduledExecutionRecord | null> {
    return this.client.getSchedule(tenantId, scheduleId);
  }

  // Lifecycle & Loop Delegation
  start(): void {
    this.loop.start();
  }

  async stop(): Promise<void> {
    await this.loop.stop();
  }

  async tick(now?: Date) {
    return this.loop.tick(now);
  }
}
