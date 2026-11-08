import type { PrismaClient, JobRecord } from "@durable/storage";
import type { ActiveJobLease } from "../types";
import { LeaseLostError } from "../errors/worker-errors";

export interface LeaseManagerOptions {
  readonly client: PrismaClient;
  readonly workerId: string;
  readonly defaultLeaseDurationMs?: number | undefined;
}

export class LeaseManager {
  private readonly client: PrismaClient;
  private readonly workerId: string;
  private readonly defaultLeaseDurationMs: number;
  private readonly activeLeases = new Map<string, ActiveJobLease>();

  constructor(options: LeaseManagerOptions) {
    this.client = options.client;
    this.workerId = options.workerId;
    this.defaultLeaseDurationMs = options.defaultLeaseDurationMs ?? 30_000;
  }

  /**
   * Tracks a newly claimed job lease.
   */
  acquire(job: JobRecord): ActiveJobLease {
    // If an existing lease is tracked for this jobId, abort it first
    const existing = this.activeLeases.get(job.id);
    if (existing) {
      existing.abortController.abort(
        new LeaseLostError(
          job.id,
          this.workerId,
          existing.fencingToken,
          `Lease re-acquired for job "${job.id}"`
        )
      );
    }

    const abortController = new AbortController();
    const leaseExpiresAt =
      job.leaseExpiresAt ??
      new Date(Date.now() + this.defaultLeaseDurationMs);

    const lease: ActiveJobLease = {
      jobId: job.id,
      tenantId: job.tenantId,
      fencingToken: job.fencingToken,
      leaseExpiresAt,
      abortController,
      startedAt: job.startedAt ?? new Date(),
    };

    this.activeLeases.set(job.id, lease);
    return lease;
  }

  /**
   * Removes tracking for a completed, failed, or cancelled job.
   */
  release(jobId: string): void {
    this.activeLeases.delete(jobId);
  }

  /**
   * Returns the active lease for a job, if currently tracked.
   */
  getLease(jobId: string): ActiveJobLease | undefined {
    return this.activeLeases.get(jobId);
  }

  /**
   * Returns the AbortSignal associated with a job lease.
   */
  getAbortSignal(jobId: string): AbortSignal | undefined {
    return this.activeLeases.get(jobId)?.abortController.signal;
  }

  /**
   * Count of currently active tracked leases.
   */
  getActiveCount(): number {
    return this.activeLeases.size;
  }

  /**
   * Returns all active job IDs.
   */
  getActiveJobIds(): string[] {
    return Array.from(this.activeLeases.keys());
  }

  /**
   * Renews an active job lease atomically in PostgreSQL.
   * Enforces:
   * 1. status = 'running'
   * 2. lease_owner = workerId
   * 3. fencing_token = expectedFencingToken
   * 4. lease_expires_at > NOW() (must not have expired already)
   */
  async renewLease(
    jobId: string,
    leaseDurationMs?: number
  ): Promise<boolean> {
    const lease = this.activeLeases.get(jobId);
    if (!lease) {
      return false;
    }

    const duration = leaseDurationMs ?? this.defaultLeaseDurationMs;

    try {
      const rows = await this.client.$queryRaw<{ leaseExpiresAt: Date }[]>`
        UPDATE jobs
        SET lease_expires_at = NOW() + ${duration} * INTERVAL '1 millisecond',
            updated_at = NOW()
        WHERE id = ${lease.jobId}::uuid
          AND tenant_id = ${lease.tenantId}::uuid
          AND status = 'running'
          AND lease_owner = ${this.workerId}::uuid
          AND fencing_token = ${lease.fencingToken}
          AND lease_expires_at > NOW()
        RETURNING lease_expires_at AS "leaseExpiresAt"
      `;

      if (rows.length === 1 && rows[0]?.leaseExpiresAt) {
        lease.leaseExpiresAt = rows[0].leaseExpiresAt;
        return true;
      }

      // Renewal failed (0 rows): lease expired, fencing token changed, or ownership lost.
      this.handleLostLease(
        lease,
        `Atomic renewal returned 0 rows for job "${jobId}"`
      );
      return false;
    } catch (error) {
      // Database error during renewal
      throw error;
    }
  }

  /**
   * Renews all active leases.
   */
  async renewAllActiveLeases(
    leaseDurationMs?: number
  ): Promise<{ renewed: number; lost: number }> {
    let renewed = 0;
    let lost = 0;

    const activeList = Array.from(this.activeLeases.values());
    for (const lease of activeList) {
      try {
        const ok = await this.renewLease(lease.jobId, leaseDurationMs);
        if (ok) {
          renewed++;
        } else {
          lost++;
        }
      } catch (err) {
        // If DB failure occurred, we do not immediately release unless verified lost,
        // but rethrow or report to caller (heartbeat coordinator)
        throw err;
      }
    }

    return { renewed, lost };
  }

  /**
   * Validates whether this worker still holds the lease and fencing token in the DB.
   */
  async validateFencingToken(
    jobId: string,
    expectedFencingToken: bigint,
    tenantId?: string
  ): Promise<boolean> {
    const targetTenantId = tenantId ?? this.activeLeases.get(jobId)?.tenantId;

    if (targetTenantId) {
      const rows = await this.client.$queryRaw<{ id: string; fencingToken: bigint }[]>`
        SELECT id, fencing_token AS "fencingToken"
        FROM jobs
        WHERE id = ${jobId}::uuid
          AND tenant_id = ${targetTenantId}::uuid
          AND status = 'running'
          AND lease_owner = ${this.workerId}::uuid
          AND fencing_token = ${expectedFencingToken}
          AND lease_expires_at > NOW()
        LIMIT 1
      `;
      return rows.length === 1;
    } else {
      const rows = await this.client.$queryRaw<{ id: string; fencingToken: bigint }[]>`
        SELECT id, fencing_token AS "fencingToken"
        FROM jobs
        WHERE id = ${jobId}::uuid
          AND status = 'running'
          AND lease_owner = ${this.workerId}::uuid
          AND fencing_token = ${expectedFencingToken}
          AND lease_expires_at > NOW()
        LIMIT 1
      `;
      return rows.length === 1;
    }
  }

  /**
   * Scans tracked leases for local wall-clock expiration.
   */
  checkExpiration(now: Date = new Date()): string[] {
    const expiredIds: string[] = [];
    for (const [jobId, lease] of this.activeLeases.entries()) {
      if (lease.leaseExpiresAt.getTime() <= now.getTime()) {
        expiredIds.push(jobId);
        this.handleLostLease(
          lease,
          `Lease wall-clock expired at ${lease.leaseExpiresAt.toISOString()}`
        );
      }
    }
    return expiredIds;
  }

  /**
   * Aborts all active leases (e.g. during emergency stop or shutdown).
   */
  abortAll(reason: Error): void {
    for (const [jobId, lease] of this.activeLeases.entries()) {
      lease.abortController.abort(reason);
      this.activeLeases.delete(jobId);
    }
  }

  private handleLostLease(lease: ActiveJobLease, detail: string): void {
    this.activeLeases.delete(lease.jobId);
    const error = new LeaseLostError(
      lease.jobId,
      this.workerId,
      lease.fencingToken,
      `Worker "${this.workerId}" lost lease for job "${lease.jobId}": ${detail}`
    );
    lease.abortController.abort(error);
  }
}
