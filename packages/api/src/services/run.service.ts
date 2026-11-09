import type {
  PrismaClient,
  IWorkflowRepository,
  IWorkflowVersionRepository,
  IWorkflowRunRepository,
  IWorkflowStepRepository,
  IWorkflowEventRepository,
  IJobRepository,
  WorkflowRunRecord,
  WorkflowStepRecord,
  WorkflowEventRecord,
  ListRunsFilter,
  PaginationParams,
  PaginatedResult,
  Json,
} from "@durable/storage";
import { withTransaction } from "@durable/storage";
import type { ExecutionEngine } from "@durable/engine";
import { NotFoundError, BadRequestError, ConflictError } from "../errors/api-errors";
import type { CreateRunDto } from "../schemas/run.schema";

export interface CreateRunResult {
  readonly run: WorkflowRunRecord;
  readonly isIdempotentReplay: boolean;
}

export class RunService {
  constructor(
    private readonly client: PrismaClient,
    private readonly workflowRepo: IWorkflowRepository,
    private readonly versionRepo: IWorkflowVersionRepository,
    private readonly runRepo: IWorkflowRunRepository,
    private readonly stepRepo: IWorkflowStepRepository,
    private readonly eventRepo: IWorkflowEventRepository,
    private readonly jobRepo: IJobRepository,
    private readonly engine?: ExecutionEngine
  ) {}

  async createRun(
    tenantId: string,
    workflowId: string,
    dto: CreateRunDto,
    idempotencyKey?: string | null
  ): Promise<CreateRunResult> {
    // 1. Check idempotency if key is provided
    if (idempotencyKey && idempotencyKey.trim().length > 0) {
      const existing = await this.runRepo.findByIdempotencyKey(tenantId, idempotencyKey.trim());
      if (existing) {
        return { run: existing, isIdempotentReplay: true };
      }
    }

    // 2. Validate workflow ownership
    const workflow = await this.workflowRepo.findById(tenantId, workflowId);
    if (!workflow) {
      throw new NotFoundError("Workflow", workflowId);
    }

    // 3. Resolve target version
    let targetVersionId: string;
    if (dto.versionId) {
      const version = await this.versionRepo.findById(dto.versionId);
      if (!version || version.workflowId !== workflowId) {
        throw new NotFoundError("WorkflowVersion", dto.versionId);
      }
      targetVersionId = version.id;
    } else {
      const activeVersion = await this.versionRepo.findActiveVersion(workflowId);
      if (!activeVersion) {
        throw new BadRequestError(
          `Workflow "${workflowId}" has no active version. Specify a versionId or activate a version first.`
        );
      }
      targetVersionId = activeVersion.id;
    }

    // 4. Transactionally create WorkflowRun and Job
    try {
      const createdRun = await withTransaction(this.client, async (tx) => {
        const run = await this.runRepo.create(
          {
            tenantId,
            workflowId,
            versionId: targetVersionId,
            input: (dto.input as unknown as Json) ?? undefined,
            idempotencyKey: idempotencyKey ? idempotencyKey.trim() : null,
          },
          tx
        );

        await this.jobRepo.create(
          {
            tenantId,
            queue: "default",
            type: "workflow.dispatch",
            payload: {
              workflowId,
              versionId: targetVersionId,
              runId: run.id,
              input: dto.input ?? null,
            } as unknown as Json,
          },
          tx
        );

        return run;
      });

      return { run: createdRun, isIdempotentReplay: false };
    } catch (err: any) {
      // Handle concurrent insert with identical idempotencyKey
      if (
        idempotencyKey &&
        (err.code === "P2002" || err.message?.includes("uq_tenant_run_idempotency") || err.name === "ConflictError")
      ) {
        const existing = await this.runRepo.findByIdempotencyKey(tenantId, idempotencyKey.trim());
        if (existing) {
          return { run: existing, isIdempotentReplay: true };
        }
      }
      throw err;
    }
  }

  async getRun(tenantId: string, runId: string): Promise<WorkflowRunRecord> {
    const run = await this.runRepo.findById(tenantId, runId);
    if (!run) {
      throw new NotFoundError("WorkflowRun", runId);
    }
    return run;
  }

  async listRuns(
    tenantId: string,
    filter: ListRunsFilter,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WorkflowRunRecord>> {
    return this.runRepo.list(tenantId, filter, pagination);
  }

  async cancelRun(tenantId: string, runId: string): Promise<WorkflowRunRecord> {
    const run = await this.getRun(tenantId, runId);

    if (this.engine) {
      return this.engine.cancel(tenantId, runId);
    }

    if (run.status === "COMPLETED" || run.status === "CANCELLED") {
      return run;
    }

    return this.runRepo.update(
      tenantId,
      runId,
      {
        status: "CANCELLED",
        completedAt: new Date(),
      },
      run.revision
    );
  }

  async retryRun(tenantId: string, runId: string): Promise<WorkflowRunRecord> {
    const run = await this.getRun(tenantId, runId);

    if (run.status !== "FAILED") {
      throw new ConflictError(
        `Only failed runs can be retried. Current status of run "${runId}" is "${run.status}".`
      );
    }

    return withTransaction(this.client, async (tx) => {
      const updatedRun = await this.runRepo.update(
        tenantId,
        runId,
        {
          status: "PENDING",
          error: undefined,
          completedAt: undefined,
        },
        run.revision,
        tx
      );

      await this.jobRepo.create(
        {
          tenantId,
          queue: "default",
          type: "workflow.dispatch",
          payload: {
            workflowId: run.workflowId,
            versionId: run.versionId,
            runId: run.id,
            input: run.input,
          } as unknown as Json,
        },
        tx
      );

      await this.eventRepo.create(
        {
          runId,
          type: "run.retried",
          payload: { retriedAt: new Date().toISOString() } as unknown as Json,
        },
        tx
      );

      return updatedRun;
    });
  }

  async getRunSteps(
    tenantId: string,
    runId: string
  ): Promise<readonly WorkflowStepRecord[]> {
    // Enforce tenant ownership
    await this.getRun(tenantId, runId);
    return this.stepRepo.listByRun(runId);
  }

  async getRunEvents(
    tenantId: string,
    runId: string
  ): Promise<readonly WorkflowEventRecord[]> {
    // Enforce tenant ownership
    await this.getRun(tenantId, runId);
    return this.eventRepo.listByRun(runId);
  }
}
