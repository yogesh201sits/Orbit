import type { IWorkerRepository } from "@durable/storage";
import type { LeaseManager } from "../leases/lease-manager";
import { DatabaseHeartbeatError } from "../errors/worker-errors";

export interface HeartbeatCoordinatorOptions {
  readonly workerRepo: IWorkerRepository;
  readonly leaseManager: LeaseManager;
  readonly tenantId: string;
  readonly workerId: string | (() => string);
  readonly heartbeatIntervalMs?: number | undefined;
  readonly leaseDurationMs?: number | undefined;
  readonly maxConsecutiveFailures?: number | undefined;
  readonly onDatabaseFailure?: ((error: Error, consecutiveFailures: number) => void) | undefined;
}

export interface HeartbeatResult {
  readonly workerHeartbeatSuccess: boolean;
  readonly renewedLeases: number;
  readonly lostLeases: number;
  readonly consecutiveFailures: number;
  readonly skippedDueToOverlap: boolean;
}

export class HeartbeatCoordinator {
  private readonly workerRepo: IWorkerRepository;
  private readonly leaseManager: LeaseManager;
  private readonly tenantId: string;
  private readonly getWorkerId: () => string;
  private readonly heartbeatIntervalMs: number;
  private readonly leaseDurationMs: number;
  private readonly maxConsecutiveFailures: number;
  private readonly onDatabaseFailure: ((error: Error, consecutiveFailures: number) => void) | undefined;

  private timer: ReturnType<typeof setInterval> | null = null;
  private isTicking = false;
  private consecutiveFailures = 0;

  constructor(options: HeartbeatCoordinatorOptions) {
    this.workerRepo = options.workerRepo;
    this.leaseManager = options.leaseManager;
    this.tenantId = options.tenantId;
    const wid = options.workerId;
    this.getWorkerId = typeof wid === "function" ? wid : () => wid;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 10_000;
    this.leaseDurationMs = options.leaseDurationMs ?? 30_000;
    this.maxConsecutiveFailures = options.maxConsecutiveFailures ?? 3;
    this.onDatabaseFailure = options.onDatabaseFailure;
  }

  get workerId(): string {
    return this.getWorkerId();
  }

  /**
   * Starts the background heartbeat interval timer.
   */
  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick().catch((err) => {
        // Unhandled errors in background tick
        console.error(`Heartbeat error in worker "${this.workerId}":`, err);
      });
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stops the heartbeat interval timer.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Performs a single heartbeat cycle.
   * Can be called directly in tests.
   */
  async tick(): Promise<HeartbeatResult> {
    // Avoid overlapping heartbeat operations
    if (this.isTicking) {
      return {
        workerHeartbeatSuccess: false,
        renewedLeases: 0,
        lostLeases: 0,
        consecutiveFailures: this.consecutiveFailures,
        skippedDueToOverlap: true,
      };
    }

    this.isTicking = true;
    try {
      // 1. Check local wall-clock lease expirations
      this.leaseManager.checkExpiration();

      // 2. Heartbeat worker in storage
      await this.workerRepo.heartbeat(this.tenantId, this.workerId);

      // 3. Renew all active job leases
      const leaseResult = await this.leaseManager.renewAllActiveLeases(
        this.leaseDurationMs
      );

      this.consecutiveFailures = 0;

      return {
        workerHeartbeatSuccess: true,
        renewedLeases: leaseResult.renewed,
        lostLeases: leaseResult.lost,
        consecutiveFailures: 0,
        skippedDueToOverlap: false,
      };
    } catch (error) {
      this.consecutiveFailures++;
      const dbError = new DatabaseHeartbeatError(this.workerId, error);

      if (this.onDatabaseFailure) {
        this.onDatabaseFailure(dbError, this.consecutiveFailures);
      }

      // If consecutive failures reach threshold, abort active leases for safety
      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        this.leaseManager.abortAll(
          new DatabaseHeartbeatError(
            this.workerId,
            `Heartbeat failed ${this.consecutiveFailures} consecutive times. Aborting active jobs for safety.`
          )
        );
      }

      return {
        workerHeartbeatSuccess: false,
        renewedLeases: 0,
        lostLeases: 0,
        consecutiveFailures: this.consecutiveFailures,
        skippedDueToOverlap: false,
      };
    } finally {
      this.isTicking = false;
    }
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }
}
