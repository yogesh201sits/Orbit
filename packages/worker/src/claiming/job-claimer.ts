import type { IJobRepository, JobRecord } from "@durable/storage";

export interface JobClaimerOptions {
  readonly jobRepo: IJobRepository;
  readonly tenantId: string;
  readonly workerId: string | (() => string);
  readonly queues: string[];
  readonly concurrency: number;
  readonly leaseDurationMs?: number | undefined;
  readonly getActiveCount: () => number;
  readonly canClaim: () => boolean;
}

export class JobClaimer {
  private readonly jobRepo: IJobRepository;
  private readonly tenantId: string;
  private readonly getWorkerId: () => string;
  private readonly queues: string[];
  private readonly concurrency: number;
  private readonly leaseDurationMs: number;
  private readonly getActiveCount: () => number;
  private readonly canClaim: () => boolean;

  constructor(options: JobClaimerOptions) {
    this.jobRepo = options.jobRepo;
    this.tenantId = options.tenantId;
    const wid = options.workerId;
    this.getWorkerId = typeof wid === "function" ? wid : () => wid;
    this.queues = [...options.queues];
    this.concurrency = options.concurrency;
    this.leaseDurationMs = options.leaseDurationMs ?? 30_000;
    this.getActiveCount = options.getActiveCount;
    this.canClaim = options.canClaim;
  }

  /**
   * Available capacity for claiming new jobs.
   */
  getAvailableCapacity(): number {
    if (!this.canClaim()) {
      return 0;
    }
    const active = this.getActiveCount();
    return Math.max(0, this.concurrency - active);
  }

  /**
   * Claims a single eligible job from the queues using atomic SKIP LOCKED.
   * Returns null if at capacity, not allowed to claim, or queue is empty.
   */
  async claimNext(): Promise<JobRecord | null> {
    if (this.getAvailableCapacity() <= 0) {
      return null;
    }

    return this.jobRepo.dequeue(
      this.tenantId,
      this.queues,
      this.getWorkerId(),
      this.leaseDurationMs
    );
  }

  /**
   * Claims up to available capacity (or limit, whichever is smaller).
   */
  async claimBatch(limit?: number): Promise<JobRecord[]> {
    const capacity = this.getAvailableCapacity();
    const countToClaim = limit !== undefined ? Math.min(limit, capacity) : capacity;

    if (countToClaim <= 0) {
      return [];
    }

    const claimedJobs: JobRecord[] = [];
    for (let i = 0; i < countToClaim; i++) {
      const job = await this.claimNext();
      if (!job) {
        // Queue is empty or no eligible jobs
        break;
      }
      claimedJobs.push(job);
    }

    return claimedJobs;
  }
}
