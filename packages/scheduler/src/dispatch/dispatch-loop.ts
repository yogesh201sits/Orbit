import type { IScheduleRepository } from "@durable/storage";
import { JobDispatcher, type DispatchResult } from "./job-dispatcher";

export interface DispatchLoopOptions {
  readonly schedulerId?: string | undefined;
  readonly scheduleRepo: IScheduleRepository;
  readonly dispatcher: JobDispatcher;
  readonly pollIntervalMs?: number | undefined;
  readonly batchSize?: number | undefined;
  readonly leaseDurationMs?: number | undefined;
  readonly maxCatchUp?: number | undefined;
}

export class DispatchLoop {
  readonly schedulerId: string;
  private readonly scheduleRepo: IScheduleRepository;
  private readonly dispatcher: JobDispatcher;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly leaseDurationMs: number;
  private readonly maxCatchUp: number;

  private isRunning = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isTickInProgress = false;

  constructor(options: DispatchLoopOptions) {
    this.schedulerId = options.schedulerId ?? crypto.randomUUID();
    this.scheduleRepo = options.scheduleRepo;
    this.dispatcher = options.dispatcher;
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
    this.batchSize = options.batchSize ?? 10;
    this.leaseDurationMs = options.leaseDurationMs ?? 30_000;
    this.maxCatchUp = options.maxCatchUp ?? 10;
  }

  /**
   * Executes a single dispatch iteration.
   * Useful for deterministic testing or manual stepping.
   */
  async tick(now: Date = new Date()): Promise<readonly DispatchResult[]> {
    if (this.isTickInProgress) {
      return [];
    }

    this.isTickInProgress = true;
    const results: DispatchResult[] = [];

    try {
      // 1. Recover any expired leases from dead scheduler instances
      await this.scheduleRepo.recoverExpiredLeases(now);

      // 2. Claim due schedules atomically using FOR UPDATE SKIP LOCKED
      const claimedSchedules = await this.scheduleRepo.claimDueSchedules(
        this.schedulerId,
        this.batchSize,
        this.leaseDurationMs,
        now
      );

      // 3. Dispatch each claimed schedule
      for (const schedule of claimedSchedules) {
        try {
          const result = await this.dispatcher.dispatchSchedule(
            schedule,
            now,
            this.maxCatchUp
          );
          results.push(result);
        } catch (err) {
          // If dispatching one schedule fails, release its lease and continue with others
          try {
            await this.scheduleRepo.update(schedule.tenantId, schedule.id, {
              leaseOwner: null,
              leaseExpiresAt: null,
            });
          } catch {
            // best-effort
          }
        }
      }
    } finally {
      this.isTickInProgress = false;
    }

    return results;
  }

  /**
   * Starts the background dispatch polling loop.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const run = async () => {
      if (!this.isRunning) return;
      try {
        await this.tick();
      } catch {
        // Suppress unhandled errors from killing the loop
      }

      if (this.isRunning) {
        this.timer = setTimeout(run, this.pollIntervalMs);
      }
    };

    run();
  }

  /**
   * Stops the background dispatch polling loop gracefully.
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Wait if a tick is currently executing
    while (this.isTickInProgress) {
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}
