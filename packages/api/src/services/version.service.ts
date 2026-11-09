import { createHash } from "node:crypto";
import type {
  IWorkflowRepository,
  IWorkflowVersionRepository,
  WorkflowVersionRecord,
  PaginationParams,
  PaginatedResult,
  Json,
} from "@durable/storage";
import { NotFoundError, ConflictError } from "../errors/api-errors";
import type { CreateVersionDto } from "../schemas/version.schema";

export class VersionService {
  constructor(
    private readonly workflowRepo: IWorkflowRepository,
    private readonly versionRepo: IWorkflowVersionRepository
  ) {}

  private computeChecksum(definition: unknown): string {
    return createHash("sha256")
      .update(JSON.stringify(definition))
      .digest("hex");
  }

  async createVersion(
    tenantId: string,
    workflowId: string,
    dto: CreateVersionDto
  ): Promise<WorkflowVersionRecord> {
    const workflow = await this.workflowRepo.findById(tenantId, workflowId);
    if (!workflow) {
      throw new NotFoundError("Workflow", workflowId);
    }

    const existingVersion = await this.versionRepo.findByWorkflowAndVersion(
      workflowId,
      dto.version
    );
    if (existingVersion) {
      throw new ConflictError(
        `Version ${dto.version} already exists for workflow "${workflowId}"`
      );
    }

    const checksum = dto.checksum ?? this.computeChecksum(dto.definition);

    return this.versionRepo.create({
      workflowId,
      version: dto.version,
      definition: dto.definition as unknown as Json,
      checksum,
      isActive: dto.isActive,
    });
  }

  async listVersions(
    tenantId: string,
    workflowId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WorkflowVersionRecord>> {
    const workflow = await this.workflowRepo.findById(tenantId, workflowId);
    if (!workflow) {
      throw new NotFoundError("Workflow", workflowId);
    }

    return this.versionRepo.listByWorkflow(workflowId, pagination);
  }

  async activateVersion(
    tenantId: string,
    workflowId: string,
    versionId: string
  ): Promise<WorkflowVersionRecord> {
    const workflow = await this.workflowRepo.findById(tenantId, workflowId);
    if (!workflow) {
      throw new NotFoundError("Workflow", workflowId);
    }

    const version = await this.versionRepo.findById(versionId);
    if (!version || version.workflowId !== workflowId) {
      throw new NotFoundError("WorkflowVersion", versionId);
    }

    return this.versionRepo.activate(versionId);
  }
}
