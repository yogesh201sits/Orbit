import type { PrismaClient } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";
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
    if (input.isActive && !tx) {
      return this.client.$transaction((transaction) =>
        this.create(input, transaction)
      );
    }

    try {
      const version = await this.db(tx).workflowVersion.create({
        data: {
          workflowId: input.workflowId,
          version: input.version,
          definition: input.definition as Prisma.InputJsonValue,
          checksum: input.checksum,
          isActive: false,
          activatedAt: null,
        },
      });
      return input.isActive ? await this.activate(version.id, tx) : version;
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
    if (!tx) {
      return this.client.$transaction((transaction) =>
        this.activate(id, transaction)
      );
    }

    const version = await this.db(tx).workflowVersion.findUnique({
      where: { id },
    });
    if (!version) {
      throw new NotFoundError("WorkflowVersion", id);
    }

    const workflows = await tx.$queryRaw<{ tenantId: string }[]>`
      SELECT tenant_id AS "tenantId"
      FROM workflows
      WHERE id = ${version.workflowId}::uuid
      FOR UPDATE
    `;
    const workflow = workflows[0];
    if (!workflow) {
      throw new NotFoundError("Workflow", version.workflowId);
    }

    await this.db(tx).workflowVersion.updateMany({
      where: { workflowId: version.workflowId, isActive: true },
      data: { isActive: false },
    });

    // Activate the target version
    const activated = await this.db(tx).workflowVersion.update({
      where: { id },
      data: { isActive: true, activatedAt: new Date() },
    });
    await tx.outboxEvent.create({
      data: {
        tenantId: workflow.tenantId,
        aggregateType: "workflow",
        aggregateId: version.workflowId,
        eventType: "workflow.version_activated",
        payload: {
          workflowId: version.workflowId,
          versionId: activated.id,
          version: activated.version,
        },
      },
    });
    return activated;
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
