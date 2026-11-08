import type { PrismaClient } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";
import type {
  TransactionClient,
  IWorkflowRepository,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  WorkflowRecord,
  PaginationParams,
  PaginatedResult,
} from "./interfaces";
import { NotFoundError, ConflictError } from "../errors/storage-errors";

export class PrismaWorkflowRepository implements IWorkflowRepository {
  constructor(private readonly client: PrismaClient) {}

  private db(tx?: TransactionClient) {
    return tx ?? this.client;
  }

  async create(
    input: CreateWorkflowInput,
    tx?: TransactionClient
  ): Promise<WorkflowRecord> {
    try {
      return await this.db(tx).workflow.create({
        data: {
          tenantId: input.tenantId,
          key: input.key,
          name: input.name,
          metadata: input.metadata ?? Prisma.JsonNull,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictError(
          `Workflow with key "${input.key}" already exists for tenant "${input.tenantId}"`,
          "uq_tenant_workflow_key"
        );
      }
      throw e;
    }
  }

  async findById(
    tenantId: string,
    id: string,
    tx?: TransactionClient
  ): Promise<WorkflowRecord | null> {
    return this.db(tx).workflow.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
  }

  async findByKey(
    tenantId: string,
    key: string,
    tx?: TransactionClient
  ): Promise<WorkflowRecord | null> {
    return this.db(tx).workflow.findFirst({
      where: { tenantId, key, deletedAt: null },
    });
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateWorkflowInput,
    tx?: TransactionClient
  ): Promise<WorkflowRecord> {
    const result = await this.db(tx).workflow.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.metadata !== undefined && { metadata: input.metadata ?? Prisma.JsonNull }),
      },
    });
    if (result.count === 0) {
      throw new NotFoundError("Workflow", id);
    }
    return this.db(tx).workflow.findFirstOrThrow({
      where: { id, tenantId, deletedAt: null },
    });
  }

  async delete(
    tenantId: string,
    id: string,
    tx?: TransactionClient
  ): Promise<void> {
    const result = await this.db(tx).workflow.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundError("Workflow", id);
    }
  }

  async list(
    tenantId: string,
    pagination: PaginationParams,
    tx?: TransactionClient
  ): Promise<PaginatedResult<WorkflowRecord>> {
    const [data, total] = await Promise.all([
      this.db(tx).workflow.findMany({
        where: { tenantId, deletedAt: null },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
      }),
      this.db(tx).workflow.count({ where: { tenantId, deletedAt: null } }),
    ]);
    return { data, total, limit: pagination.limit, offset: pagination.offset };
  }
}
