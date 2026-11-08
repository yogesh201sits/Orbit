import type { PrismaClient, IJobRepository, IWorkerRepository } from "@durable/storage";

export interface RecoveryCoordinatorOptions {
  readonly client: PrismaClient;
  readonly jobRepo: IJobRepository;
  readonly workerRepo: IWorkerRepository;
  readonly tenantId: string;
  readonly staleWorkerTimeoutMs?: number | undefined;
  readonly recoveryIntervalMs?: number | undefined;
}

export interface RecoveryResult {
  readonly expiredLeasesRecovered: number;
  readonly staleWorkersDeactivated: number;
  readonly skippedDueToOverlap: boolean;
}

export class RecoveryCoordinator {
  private readonly client: PrismaClient;
  private readonly jobRepo: IJobRepository;
  private readonly workerRepo: IWorkerRepository;
  private readonly tenantId: string;
  private readonly staleWorkerTimeoutMs: number;
  private readonly recoveryIntervalMs: number;

  private timer: ReturnType<typeof setInterval> | null = null;
  private isRecovering = false;

  constructor(options: RecoveryCoordinatorOptions) {
    this.client = options.client;
    this.jobRepo = options.jobRepo;
    this.workerRepo = options.workerRepo;
    this.tenantId = options.tenantId;
    this.staleWorkerTimeoutMs = options.staleWorkerTimeoutMs ?? 60_000;
    this.recoveryIntervalMs = options.recoveryIntervalMs ?? 30_000;
  }

  /**
   * Starts background recovery timer.
   */
  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick().catch((err) => {
        console.error("Background recovery error:", err);
      });
    }, this.recoveryIntervalMs);
  }

  /**
   * Stops background recovery timer.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Performs a single recovery cycle.
   */
  async tick(): Promise<RecoveryResult> {
    if (this.isRecovering) {
      return {
        expiredLeasesRecovered: 0,
        staleWorkersDeactivated: 0,
        skippedDueToOverlap: true,
      };
    }

    this.isRecovering = true;
    try {
      // 1. Recover expired job leases (bumps fencing token, sets back to pending or failed)
      const expiredLeasesRecovered = await this.recoverExpiredJobLeases();

      // 2. Identify and deactivate crashed/stale workers
      const staleWorkersDeactivated = await this.deactivateStaleWorkers();

      return {
        expiredLeasesRecovered,
        staleWorkersDeactivated,
        skippedDueToOverlap: false,
      };
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Recovers jobs with expired leases in the database.
   */
  async recoverExpiredJobLeases(): Promise<number> {
    return this.jobRepo.recoverExpiredLeases();
  }

  /**
   * Deactivates workers that have missed heartbeats beyond the stale timeout.
   */
  async deactivateStaleWorkers(thresholdMs?: number): Promise<number> {
    const timeout = thresholdMs ?? this.staleWorkerTimeoutMs;
    const cutoff = new Date(Date.now() - timeout);

    const deactivated = await this.client.$queryRaw<{ id: string }[]>`
      UPDATE workers
      SET status = 'inactive',
          updated_at = NOW()
      WHERE tenant_id = ${this.tenantId}::uuid
        AND status = 'active'
        AND (
          last_heartbeat IS NULL
          OR last_heartbeat < ${cutoff}
        )
      RETURNING id
    `;

    return deactivated.length;
  }

  /**
   * Simulates or handles worker crash recovery:
   * 1. Marks the crashed worker as INACTIVE.
   * 2. Force-expires all running jobs owned by this worker.
   * 3. Immediately reclaims all expired jobs so other workers can process them.
   */
  async recoverCrashedWorker(crashedWorkerId: string): Promise<number> {
    // 1. Deactivate worker
    await this.client.$executeRaw`
      UPDATE workers
      SET status = 'inactive',
          updated_at = NOW()
      WHERE id = ${crashedWorkerId}::uuid
        AND tenant_id = ${this.tenantId}::uuid
    `;

    // 2. Force expire leases for jobs owned by crashed worker
    await this.client.$executeRaw`
      UPDATE jobs
      SET lease_expires_at = NOW() - INTERVAL '1 millisecond',
          updated_at = NOW()
      WHERE tenant_id = ${this.tenantId}::uuid
        AND lease_owner = ${crashedWorkerId}::uuid
        AND status = 'running'
    `;

    // 3. Atomically recover expired leases
    return this.recoverExpiredJobLeases();
  }
}
