import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type {
  TransactionClient,
  IWorkflowVersionRepository,
  CreateWorkflowVersionInput,
  WorkflowVersionRecord,
  PaginationParams,
  PaginatedResult,
} from "./interfaces";
import { NotFoundError, ConflictError } from "../errors/storage-errors";

export class PrismaWorkflowVersionRepository
  implements IWorkflowVersionRepository
{
  constructor(private readonly client: PrismaClient) {}

  private db(tx?: TransactionClient) {
    return tx ?? this.client;
  }

  async create(
    input: CreateWorkflowVersionInput,
    tx?: TransactionClient
  ): Promise<WorkflowVersionRecord> {
    try {
      return await this.db(tx).workflowVersion.create({
        data: {
          workflowId: input.workflowId,
          version: input.version,
          definition: input.definition as Prisma.InputJsonValue,
          checksum: input.checksum,
          isActive: input.isActive ?? false,
          activatedAt: input.isActive ? new Date() : null,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictError(
          `Version ${input.version} already exists for workflow "${input.workflowId}"`,
          "uq_workflow_version"
        );
      }
      throw e;
    }
  }

  async findById(
    id: string,
    tx?: TransactionClient
  ): Promise<WorkflowVersionRecord | null> {
    return this.db(tx).workflowVersion.findUnique({ where: { id } });
  }

  async findByWorkflowAndVersion(
    workflowId: string,
    version: number,
    tx?: TransactionClient
  ): Promise<WorkflowVersionRecord | null> {
    return this.db(tx).workflowVersion.findUnique({
      where: {
        uq_workflow_version: { workflowId, version },
      },
    });
  }

  async findActiveVersion(
    workflowId: string,
    tx?: TransactionClient
  ): Promise<WorkflowVersionRecord | null> {
    return this.db(tx).workflowVersion.findFirst({
      where: { workflowId, isActive: true },
    });
  }

  async activate(
    id: string,
    tx?: TransactionClient
  ): Promise<WorkflowVersionRecord> {
    const version = await this.db(tx).workflowVersion.findUnique({
      where: { id },
    });
    if (!version) {
      throw new NotFoundError("WorkflowVersion", id);
    }

    // Deactivate all other versions for this workflow
    await this.db(tx).workflowVersion.updateMany({
      where: { workflowId: version.workflowId, isActive: true },
      data: { isActive: false },
    });

    // Activate the target version
    return this.db(tx).workflowVersion.update({
      where: { id },
      data: { isActive: true, activatedAt: new Date() },
    });
  }

  async listByWorkflow(
    workflowId: string,
    pagination: PaginationParams,
    tx?: TransactionClient
  ): Promise<PaginatedResult<WorkflowVersionRecord>> {
    const [data, total] = await Promise.all([
      this.db(tx).workflowVersion.findMany({
        where: { workflowId },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { version: "desc" },
      }),
      this.db(tx).workflowVersion.count({ where: { workflowId } }),
    ]);
    return { data, total, limit: pagination.limit, offset: pagination.offset };
  }
}
