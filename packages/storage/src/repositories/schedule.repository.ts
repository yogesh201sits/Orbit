import type { PrismaClient } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";
import type {
  TransactionClient,
  IScheduleRepository,
  CreateWorkflowScheduleInput,
  UpdateWorkflowScheduleInput,
  WorkflowScheduleRecord,
  PaginationParams,
  PaginatedResult,
} from "./interfaces";
import { NotFoundError } from "../errors/storage-errors";

export class PrismaScheduleRepository implements IScheduleRepository {
  constructor(private readonly client: PrismaClient) {}

  private db(tx?: TransactionClient) {
    return tx ?? this.client;
  }

  async create(
    input: CreateWorkflowScheduleInput,
    tx?: TransactionClient
  ): Promise<WorkflowScheduleRecord> {
    const data: Prisma.WorkflowScheduleCreateInput = {
      tenant: { connect: { id: input.tenantId } },
      workflow: { connect: { id: input.workflowId } },
      cronExpression: input.cronExpression ?? null,
      timezone: input.timezone ?? "UTC",
      input: input.input ?? Prisma.JsonNull,
      missedExecutionPolicy: input.missedExecutionPolicy ?? "SKIP",
      status: "ACTIVE",
      nextRunAt: input.nextRunAt,
    };

    return await this.db(tx).workflowSchedule.create({ data });
  }

  async findById(
    tenantId: string,
    id: string,
    tx?: TransactionClient
  ): Promise<WorkflowScheduleRecord | null> {
    return this.db(tx).workflowSchedule.findFirst({
      where: { id, tenantId },
    });
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateWorkflowScheduleInput,
    tx?: TransactionClient
  ): Promise<WorkflowScheduleRecord> {
    const existing = await this.db(tx).workflowSchedule.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundError("WorkflowSchedule", id);
    }

    return await this.db(tx).workflowSchedule.update({
      where: { id },
      data: {
        ...(input.cronExpression !== undefined && { cronExpression: input.cronExpression }),
        ...(input.timezone !== undefined && { timezone: input.timezone }),
        ...(input.input !== undefined && { input: input.input ?? Prisma.JsonNull }),
        ...(input.missedExecutionPolicy !== undefined && { missedExecutionPolicy: input.missedExecutionPolicy }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.nextRunAt !== undefined && { nextRunAt: input.nextRunAt }),
        ...(input.lastRunAt !== undefined && { lastRunAt: input.lastRunAt }),
        ...(input.leaseOwner !== undefined && { leaseOwner: input.leaseOwner }),
        ...(input.leaseExpiresAt !== undefined && { leaseExpiresAt: input.leaseExpiresAt }),
      },
    });
  }

  async cancel(
    tenantId: string,
    id: string,
    tx?: TransactionClient
  ): Promise<WorkflowScheduleRecord> {
    const existing = await this.db(tx).workflowSchedule.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundError("WorkflowSchedule", id);
    }

    return await this.db(tx).workflowSchedule.update({
      where: { id },
      data: {
        status: "CANCELLED",
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
  }

  async claimDueSchedules(
    schedulerId: string,
    limit: number,
    leaseDurationMs = 30_000,
    now: Date = new Date(),
    tx?: TransactionClient
  ): Promise<readonly WorkflowScheduleRecord[]> {
    if (limit <= 0) return [];

    const dbClient = this.db(tx);
    const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);

    const claimed = await dbClient.$queryRaw<WorkflowScheduleRecord[]>`
      UPDATE workflow_schedules
      SET lease_owner = ${schedulerId}::uuid,
          lease_expires_at = ${leaseExpiresAt},
          updated_at = NOW()
      WHERE id IN (
        SELECT id FROM workflow_schedules
        WHERE status = 'active'
          AND next_run_at <= ${now}
          AND (lease_owner IS NULL OR lease_expires_at < ${now})
        ORDER BY next_run_at ASC, created_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        id,
        tenant_id AS "tenantId",
        workflow_id AS "workflowId",
        cron_expression AS "cronExpression",
        timezone,
        input,
        UPPER(missed_execution_policy::text) AS "missedExecutionPolicy",
        UPPER(status::text) AS status,
        next_run_at AS "nextRunAt",
        last_run_at AS "lastRunAt",
        lease_owner AS "leaseOwner",
        lease_expires_at AS "leaseExpiresAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    return claimed;
  }

  async recoverExpiredLeases(
    now: Date = new Date(),
    tx?: TransactionClient
  ): Promise<number> {
    const dbClient = this.db(tx);
    const result = await dbClient.$executeRaw`
      UPDATE workflow_schedules
      SET lease_owner = NULL,
          lease_expires_at = NULL,
          updated_at = NOW()
      WHERE status = 'active'
        AND lease_expires_at IS NOT NULL
        AND lease_expires_at < ${now}
    `;
    return result;
  }

  async list(
    tenantId: string,
    pagination: PaginationParams,
    tx?: TransactionClient
  ): Promise<PaginatedResult<WorkflowScheduleRecord>> {
    const [total, data] = await Promise.all([
      this.db(tx).workflowSchedule.count({
        where: { tenantId },
      }),
      this.db(tx).workflowSchedule.findMany({
        where: { tenantId },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      data,
      total,
      limit: pagination.limit,
      offset: pagination.offset,
    };
  }
}
