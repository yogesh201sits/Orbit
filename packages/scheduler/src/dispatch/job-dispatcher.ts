import type {
  PrismaClient,
  TransactionClient,
  IScheduleRepository,
  IJobRepository,
  IWorkflowRunRepository,
  IWorkflowVersionRepository,
  WorkflowScheduleRecord,
  Json,
} from "@durable/storage";
import { withTransaction } from "@durable/storage";
import { resolveMissedOccurrences } from "../recurrence/missed-policy";

export interface DispatchResult {
  readonly scheduleId: string;
  readonly dispatchedCount: number;
  readonly runIds: readonly string[];
  readonly nextRunAt: Date | null;
}

export class JobDispatcher {
  constructor(
    private readonly client: PrismaClient,
    private readonly scheduleRepo: IScheduleRepository,
    private readonly jobRepo: IJobRepository,
    private readonly runRepo: IWorkflowRunRepository,
    private readonly versionRepo?: IWorkflowVersionRepository
  ) {}

  /**
   * Dispatches a claimed schedule transactionally:
   * 1. Resolves missed occurrences (for recurring) or uses single runAt (for delayed).
   * 2. Transactionally creates workflow runs, creates jobs, and advances schedule.
   */
  async dispatchSchedule(
    schedule: WorkflowScheduleRecord,
    now: Date = new Date(),
    maxCatchUp = 10
  ): Promise<DispatchResult> {
    const isRecurring = schedule.cronExpression !== null;

    let dispatchTimes: readonly Date[];
    let nextRunAt: Date | null;

    if (isRecurring) {
      const resolved = resolveMissedOccurrences({
        cronExpression: schedule.cronExpression!,
        timezone: schedule.timezone,
        policy: schedule.missedExecutionPolicy,
        scheduledNextRunAt: schedule.nextRunAt,
        now,
        maxCatchUp,
      });
      dispatchTimes = resolved.dispatchTimes;
      nextRunAt = resolved.nextRunAt;
    } else {
      dispatchTimes = [schedule.nextRunAt];
      nextRunAt = null; // One-time execution completed
    }

    const runIds: string[] = [];

    await withTransaction(this.client, async (tx) => {
      // Find active version for the workflow if versionRepo available
      let versionId: string | null = null;
      if (this.versionRepo) {
        const activeVer = await this.versionRepo.findActiveVersion(schedule.workflowId, tx);
        versionId = activeVer?.id ?? null;
      }

      for (const time of dispatchTimes) {
        let runId: string | null = null;

        // Create WorkflowRun if versionId is present
        if (versionId) {
          const run = await this.runRepo.create(
            {
              tenantId: schedule.tenantId,
              workflowId: schedule.workflowId,
              versionId,
              input: schedule.input as unknown as Json,
            },
            tx
          );
          runId = run.id;
          runIds.push(run.id);
        }

        // Create Job in the queue for worker execution
        await this.jobRepo.create(
          {
            tenantId: schedule.tenantId,
            queue: "default",
            type: "workflow.dispatch",
            payload: {
              scheduleId: schedule.id,
              workflowId: schedule.workflowId,
              runId,
              scheduledFor: time.toISOString(),
              input: schedule.input,
            } as unknown as Json,
            scheduledAt: time,
          },
          tx
        );
      }

      // Update schedule state
      if (isRecurring && nextRunAt) {
        await this.scheduleRepo.update(
          schedule.tenantId,
          schedule.id,
          {
            nextRunAt,
            lastRunAt: now,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
          tx
        );
      } else {
        // One-time delayed schedule completed: pause it
        await this.scheduleRepo.update(
          schedule.tenantId,
          schedule.id,
          {
            status: "PAUSED",
            lastRunAt: now,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
          tx
        );
      }
    });

    return {
      scheduleId: schedule.id,
      dispatchedCount: dispatchTimes.length,
      runIds,
      nextRunAt,
    };
  }
}
