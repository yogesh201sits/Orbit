import type {
  IWorkflowRepository,
  WorkflowRecord,
  PaginationParams,
  PaginatedResult,
  Json,
} from "@durable/storage";
import { NotFoundError, ConflictError } from "../errors/api-errors";
import type { CreateWorkflowDto, UpdateWorkflowDto } from "../schemas/workflow.schema";

export class WorkflowService {
  constructor(private readonly workflowRepo: IWorkflowRepository) {}

  async createWorkflow(
    tenantId: string,
    dto: CreateWorkflowDto
  ): Promise<WorkflowRecord> {
    const existing = await this.workflowRepo.findByKey(tenantId, dto.key);
    if (existing) {
      throw new ConflictError(`Workflow with key "${dto.key}" already exists for this tenant`);
    }

    return this.workflowRepo.create({
      tenantId,
      key: dto.key,
      name: dto.name,
      metadata: (dto.metadata as unknown as Json) ?? undefined,
    });
  }

  async getWorkflow(
    tenantId: string,
    workflowId: string
  ): Promise<WorkflowRecord> {
    const workflow = await this.workflowRepo.findById(tenantId, workflowId);
    if (!workflow) {
      throw new NotFoundError("Workflow", workflowId);
    }
    return workflow;
  }

  async listWorkflows(
    tenantId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WorkflowRecord>> {
    return this.workflowRepo.list(tenantId, pagination);
  }

  async updateWorkflow(
    tenantId: string,
    workflowId: string,
    dto: UpdateWorkflowDto
  ): Promise<WorkflowRecord> {
    // Assert workflow exists and belongs to tenant
    await this.getWorkflow(tenantId, workflowId);

    return this.workflowRepo.update(tenantId, workflowId, {
      name: dto.name,
      metadata: (dto.metadata as unknown as Json) ?? undefined,
    });
  }

  async deleteWorkflow(
    tenantId: string,
    workflowId: string
  ): Promise<void> {
    await this.getWorkflow(tenantId, workflowId);
    await this.workflowRepo.delete(tenantId, workflowId);
  }
}
