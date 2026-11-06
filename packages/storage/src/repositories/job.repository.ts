import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type {
  TransactionClient,
  IJobRepository,
  CreateJobInput,
  UpdateJobInput,
  JobRecord,
  PaginationParams,
  PaginatedResult,
} from "./interfaces";
import { NotFoundError } from "../errors/storage-errors";

export class PrismaJobRepository implements IJobRepository {
  constructor(private readonly client: PrismaClient) {}

  private db(tx?: TransactionClient) {
    return tx ?? this.client;
  }

  async create(
    input: CreateJobInput,
    tx?: TransactionClient
  ): Promise<JobRecord> {
    return this.db(tx).job.create({
      data: {
        tenantId: input.tenantId,
        queue: input.queue,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
        status: "pending",
        priority: input.priority ?? 0,
        maxRetries: input.maxRetries ?? 3,
        scheduledAt: input.scheduledAt ?? new Date(),
      },
    });
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
    const existing = await this.db(tx).job.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundError("Job", id);
    }
    return this.db(tx).job.update({
      where: { id },
      data: {
        ...(input.status !== undefined && { status: input.status }),
        ...(input.error !== undefined && { error: input.error ?? Prisma.JsonNull }),
        ...(input.retryCount !== undefined && { retryCount: input.retryCount }),
        ...(input.startedAt !== undefined && { startedAt: input.startedAt }),
        ...(input.completedAt !== undefined && { completedAt: input.completedAt }),
      },
    });
  }

  async dequeue(
    tenantId: string,
    queues: string[],
    tx?: TransactionClient
  ): Promise<JobRecord | null> {
    // Use raw SQL for atomic dequeue with FOR UPDATE SKIP LOCKED
    const result = await (this.db(tx) as PrismaClient).$queryRaw<JobRecord[]>`
      UPDATE jobs
      SET status = 'processing', started_at = NOW(), updated_at = NOW()
      WHERE id = (
        SELECT id FROM jobs
        WHERE tenant_id = ${tenantId}::uuid
          AND queue = ANY(${queues})
          AND status = 'pending'
          AND scheduled_at <= NOW()
        ORDER BY priority DESC, scheduled_at ASC
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
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;
    return result[0] ?? null;
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
