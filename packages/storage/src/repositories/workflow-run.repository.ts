import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
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
    return this.db(tx).workflowRun.create({
      data: {
        tenantId: input.tenantId,
        workflowId: input.workflowId,
        versionId: input.versionId,
        status: "pending",
        input: input.input ?? Prisma.JsonNull,
        revision: 1,
      },
    });
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

  async update(
    tenantId: string,
    id: string,
    input: UpdateWorkflowRunInput,
    expectedRevision: number,
    tx?: TransactionClient
  ): Promise<WorkflowRunRecord> {
    // Optimistic concurrency: update only if revision matches
    const result = await this.db(tx).workflowRun.updateMany({
      where: { id, tenantId, revision: expectedRevision },
      data: {
        ...(input.status !== undefined && { status: input.status }),
        ...(input.output !== undefined && { output: input.output ?? Prisma.JsonNull }),
        ...(input.error !== undefined && { error: input.error ?? Prisma.JsonNull }),
        ...(input.startedAt !== undefined && { startedAt: input.startedAt }),
        ...(input.completedAt !== undefined && { completedAt: input.completedAt }),
        revision: expectedRevision + 1,
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
    return updated!;
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
