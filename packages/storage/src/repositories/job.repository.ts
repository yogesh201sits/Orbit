import type { PrismaClient } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";
import type {
  TransactionClient,
  IJobRepository,
  CreateJobInput,
  UpdateJobInput,
  JobRecord,
  PaginationParams,
  PaginatedResult,
} from "./interfaces";
import { ConflictError, NotFoundError } from "../errors/storage-errors";

export class PrismaJobRepository implements IJobRepository {
  constructor(private readonly client: PrismaClient) {}

  private db(tx?: TransactionClient) {
    return tx ?? this.client;
  }

  async create(
    input: CreateJobInput,
    tx?: TransactionClient
  ): Promise<JobRecord> {
    if (!tx) {
      return this.client.$transaction((transaction) =>
        this.create(input, transaction)
      );
    }

    const job = await tx.job.create({
      data: {
        tenantId: input.tenantId,
        queue: input.queue,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
        status: "PENDING",
        priority: input.priority ?? 0,
        maxRetries: input.maxRetries ?? 3,
        scheduledAt: input.scheduledAt ?? new Date(),
      },
    });
    await this.createOutboxEvent(job, "job.created", tx);
    return job;
  }

  async findById(
    tenantId: string,
    id: string,
    tx?: TransactionClient
  ): Promise<JobRecord | null> {
    return this.db(tx).job.findFirst({
      where: { id, tenantId },
    });
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateJobInput,
    tx?: TransactionClient
  ): Promise<JobRecord> {
    if (!tx) {
      return this.client.$transaction((transaction) =>
        this.update(tenantId, id, input, transaction)
      );
    }

    const existing = await this.db(tx).job.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundError("Job", id);
    }
    if (
      existing.status === "RUNNING" &&
      input.expectedFencingToken === undefined
    ) {
      throw new ConflictError(
        "A fencing token is required to update a running job",
        "job_fencing_token"
      );
    }
    const result = await this.db(tx).job.updateMany({
      where: {
        id,
        tenantId,
        status: existing.status,
        ...(existing.status === "RUNNING" && {
          leaseExpiresAt: { gt: new Date() },
        }),
        ...(input.expectedFencingToken !== undefined && {
          fencingToken: input.expectedFencingToken,
        }),
      },
      data: {
        ...(input.status !== undefined && { status: input.status }),
        ...(input.error !== undefined && { error: input.error ?? Prisma.JsonNull }),
        ...(input.retryCount !== undefined && { retryCount: input.retryCount }),
        ...(input.startedAt !== undefined && { startedAt: input.startedAt }),
        ...(input.completedAt !== undefined && { completedAt: input.completedAt }),
      },
    });
    if (result.count === 0) {
      throw new ConflictError(
        "Job state or lease fencing token changed",
        "job_fencing_token"
      );
    }
    const job = await this.db(tx).job.findUniqueOrThrow({ where: { id } });
    await this.createOutboxEvent(job, "job.updated", tx);
    return job;
  }

  async dequeue(
    tenantId: string,
    queues: string[],
    workerId: string,
    leaseDurationMs = 30_000,
    tx?: TransactionClient
  ): Promise<JobRecord | null> {
    if (!tx) {
      return this.client.$transaction((transaction) =>
        this.dequeue(tenantId, queues, workerId, leaseDurationMs, transaction)
      );
    }

    if (!Number.isSafeInteger(leaseDurationMs) || leaseDurationMs <= 0) {
      throw new RangeError("leaseDurationMs must be a positive safe integer");
    }
    if (queues.length === 0) {
      return null;
    }

    const worker = await tx.worker.findFirst({
      where: { id: workerId, tenantId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!worker) {
      throw new NotFoundError("Active worker", workerId);
    }

    const result = await tx.$queryRaw<JobRecord[]>`
      UPDATE jobs
      SET status = 'running',
          started_at = NOW(),
          lease_owner = ${workerId}::uuid,
          lease_expires_at = NOW() + ${leaseDurationMs} * INTERVAL '1 millisecond',
          fencing_token = fencing_token + 1,
          claimed_at = NOW(),
          updated_at = NOW()
      WHERE id = (
        SELECT id FROM jobs
        WHERE tenant_id = ${tenantId}::uuid
          AND queue = ANY(${queues})
          AND EXISTS (
            SELECT 1
            FROM workers
            WHERE id = ${workerId}::uuid
              AND tenant_id = ${tenantId}::uuid
              AND status = 'active'
              AND queue = ANY(queues)
          )
          AND status = 'pending'
          AND scheduled_at <= NOW()
        ORDER BY priority DESC, scheduled_at ASC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        id,
        tenant_id AS "tenantId",
        queue,
        type,
        payload,
        status,
        priority,
        max_retries AS "maxRetries",
        retry_count AS "retryCount",
        scheduled_at AS "scheduledAt",
        started_at AS "startedAt",
        completed_at AS "completedAt",
        error,
        lease_owner AS "leaseOwner",
        lease_expires_at AS "leaseExpiresAt",
        fencing_token AS "fencingToken",
        claimed_at AS "claimedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;
    const job = result[0];
    if (!job) {
      return null;
    }
    const claimedJob = { ...job, status: "RUNNING" as const };
    await this.createOutboxEvent(claimedJob, "job.claimed", tx);
    return claimedJob;
  }

  async recoverExpiredLeases(tx?: TransactionClient): Promise<number> {
    if (!tx) {
      return this.client.$transaction((transaction) =>
        this.recoverExpiredLeases(transaction)
      );
    }

    const recovered = await tx.$queryRaw<
      Pick<JobRecord, "id" | "tenantId" | "status" | "retryCount">[]
    >`
      UPDATE jobs
      SET status = CASE
            WHEN retry_count + 1 >= max_retries THEN 'failed'::job_status
            ELSE 'pending'::job_status
          END,
          retry_count = retry_count + 1,
          scheduled_at = NOW(),
          completed_at = CASE
            WHEN retry_count + 1 >= max_retries THEN NOW()
            ELSE NULL
          END,
          lease_owner = NULL,
          lease_expires_at = NULL,
          fencing_token = fencing_token + 1,
          started_at = NULL,
          updated_at = NOW()
      WHERE status = 'running'
        AND lease_expires_at IS NOT NULL
        AND lease_expires_at <= NOW()
      RETURNING
        id,
        tenant_id AS "tenantId",
        status,
        retry_count AS "retryCount"
    `;
    for (const job of recovered) {
      await tx.outboxEvent.create({
        data: {
          tenantId: job.tenantId,
          aggregateType: "job",
          aggregateId: job.id,
          eventType: "job.lease_recovered",
          payload: {
            jobId: job.id,
            status: job.status,
            retryCount: job.retryCount,
          },
        },
      });
    }
    return recovered.length;
  }

  private async createOutboxEvent(
    job: Pick<JobRecord, "id" | "tenantId" | "status" | "fencingToken">,
    eventType: string,
    tx: TransactionClient
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        tenantId: job.tenantId,
        aggregateType: "job",
        aggregateId: job.id,
        eventType,
        payload: {
          jobId: job.id,
          status: job.status,
          fencingToken: job.fencingToken.toString(),
        },
      },
    });
  }

  async listByQueue(
    tenantId: string,
    queue: string,
    pagination: PaginationParams,
    tx?: TransactionClient
  ): Promise<PaginatedResult<JobRecord>> {
    const where = { tenantId, queue };
    const [data, total] = await Promise.all([
      this.db(tx).job.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: [{ priority: "desc" }, { scheduledAt: "asc" }],
      }),
      this.db(tx).job.count({ where }),
    ]);
    return { data, total, limit: pagination.limit, offset: pagination.offset };
  }
}
