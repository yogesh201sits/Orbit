import type { PrismaClient } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";
import type {
  TransactionClient,
  IWorkflowRunRepository,
  CreateWorkflowRunInput,
  UpdateWorkflowRunInput,
  WorkflowRunRecord,
  ListRunsFilter,
  PaginationParams,
  PaginatedResult,
} from "./interfaces";
import { NotFoundError, StaleRevisionError } from "../errors/storage-errors";

export class PrismaWorkflowRunRepository implements IWorkflowRunRepository {
  constructor(private readonly client: PrismaClient) {}

  private db(tx?: TransactionClient) {
    return tx ?? this.client;
  }

  async create(
    input: CreateWorkflowRunInput,
    tx?: TransactionClient
  ): Promise<WorkflowRunRecord> {
    if (!tx) {
      return this.client.$transaction((transaction) =>
        this.create(input, transaction)
      );
    }

    const run = await tx.workflowRun.create({
      data: {
        tenantId: input.tenantId,
        workflowId: input.workflowId,
        versionId: input.versionId,
        status: "PENDING",
        input: input.input ?? Prisma.JsonNull,
        revision: 1,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
    await this.createOutboxEvent(run, "workflow_run.created", tx);
    return run;
  }

  async findById(
    tenantId: string,
    id: string,
    tx?: TransactionClient
  ): Promise<WorkflowRunRecord | null> {
    return this.db(tx).workflowRun.findFirst({
      where: { id, tenantId },
    });
  }

  async findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
    tx?: TransactionClient
  ): Promise<WorkflowRunRecord | null> {
    return this.db(tx).workflowRun.findFirst({
      where: { tenantId, idempotencyKey },
    });
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateWorkflowRunInput,
    expectedRevision: number,
    tx?: TransactionClient
  ): Promise<WorkflowRunRecord> {
    if (!tx) {
      return this.client.$transaction((transaction) =>
        this.update(tenantId, id, input, expectedRevision, transaction)
      );
    }

    // Optimistic concurrency: update only if revision matches
    const result = await this.db(tx).workflowRun.updateMany({
      where: { id, tenantId, revision: expectedRevision },
      data: {
        ...(input.status !== undefined && { status: input.status }),
        ...(input.output !== undefined && { output: input.output ?? Prisma.JsonNull }),
        ...(input.error !== undefined && { error: input.error ?? Prisma.JsonNull }),
        ...(input.startedAt !== undefined && { startedAt: input.startedAt }),
        ...(input.completedAt !== undefined && { completedAt: input.completedAt }),
        revision: { increment: 1 },
      },
    });

    if (result.count === 0) {
      // Determine if the entity exists at all
      const existing = await this.db(tx).workflowRun.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        throw new NotFoundError("WorkflowRun", id);
      }
      throw new StaleRevisionError("WorkflowRun", id, expectedRevision);
    }

    // Fetch the updated record
    const updated = await this.db(tx).workflowRun.findFirst({
      where: { id, tenantId },
    });
    if (!updated) {
      throw new NotFoundError("WorkflowRun", id);
    }
    await this.createOutboxEvent(
      updated,
      input.status === undefined
        ? "workflow_run.updated"
        : "workflow_run.status_changed",
      tx
    );
    return updated;
  }

  private async createOutboxEvent(
    run: WorkflowRunRecord,
    eventType: string,
    tx: TransactionClient
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        tenantId: run.tenantId,
        aggregateType: "workflow_run",
        aggregateId: run.id,
        eventType,
        payload: {
          runId: run.id,
          status: run.status,
          revision: run.revision,
        },
      },
    });
  }

  async list(
    tenantId: string,
    filter: ListRunsFilter,
    pagination: PaginationParams,
    tx?: TransactionClient
  ): Promise<PaginatedResult<WorkflowRunRecord>> {
    const where: Prisma.WorkflowRunWhereInput = {
      tenantId,
      ...(filter.status && { status: filter.status }),
      ...(filter.workflowId && { workflowId: filter.workflowId }),
      ...((filter.from || filter.to) && {
        createdAt: {
          ...(filter.from && { gte: filter.from }),
          ...(filter.to && { lte: filter.to }),
        },
      }),
    };
    const [data, total] = await Promise.all([
      this.db(tx).workflowRun.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
      }),
      this.db(tx).workflowRun.count({ where }),
    ]);
    return { data, total, limit: pagination.limit, offset: pagination.offset };
  }
}
