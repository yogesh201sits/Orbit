import type {
  IWorkflowRunRepository,
  IWorkflowStepRepository,
  IWorkflowEventRepository,
  CreateWorkflowRunInput,
  UpdateWorkflowRunInput,
  WorkflowRunRecord,
  ListRunsFilter,
  PaginationParams,
  PaginatedResult,
  CreateWorkflowStepInput,
  UpdateWorkflowStepInput,
  WorkflowStepRecord,
  CreateWorkflowEventInput,
  WorkflowEventRecord,
  WorkflowRunStatus,
  WorkflowStepStatus,
} from "@durable/storage";
import {
  NotFoundError,
  ConflictError,
  StaleRevisionError,
} from "@durable/storage";

export class InMemoryWorkflowRunRepository implements IWorkflowRunRepository {
  public runs = new Map<string, WorkflowRunRecord>();
  public shouldFailNext = false;

  async create(input: CreateWorkflowRunInput): Promise<WorkflowRunRecord> {
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw new Error("Simulated persistence failure");
    }
    const id = `run-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    const record: WorkflowRunRecord = {
      id,
      tenantId: input.tenantId,
      workflowId: input.workflowId,
      versionId: input.versionId,
      status: "PENDING",
      input: input.input ?? null,
      output: null,
      error: null,
      revision: 1,
      idempotencyKey: input.idempotencyKey ?? null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.runs.set(`${input.tenantId}:${id}`, record);
    return record;
  }

  async findById(tenantId: string, id: string): Promise<WorkflowRunRecord | null> {
    return this.runs.get(`${tenantId}:${id}`) ?? null;
  }

  async findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string
  ): Promise<WorkflowRunRecord | null> {
    for (const run of this.runs.values()) {
      if (run.tenantId === tenantId && run.idempotencyKey === idempotencyKey) {
        return run;
      }
    }
    return null;
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateWorkflowRunInput,
    expectedRevision: number
  ): Promise<WorkflowRunRecord> {
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw new Error("Simulated persistence failure");
    }

    const key = `${tenantId}:${id}`;
    const existing = this.runs.get(key);
    if (!existing) {
      throw new NotFoundError("WorkflowRun", id);
    }

    if (existing.revision !== expectedRevision) {
      throw new StaleRevisionError("WorkflowRun", id, expectedRevision);
    }

    const updated: WorkflowRunRecord = {
      ...existing,
      status: input.status ?? existing.status,
      output: input.output !== undefined ? input.output : existing.output,
      error: input.error !== undefined ? input.error : existing.error,
      startedAt: input.startedAt ?? existing.startedAt,
      completedAt: input.completedAt ?? existing.completedAt,
      revision: existing.revision + 1,
      updatedAt: new Date(),
    };

    this.runs.set(key, updated);
    return updated;
  }

  async list(
    tenantId: string,
    filter: ListRunsFilter,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WorkflowRunRecord>> {
    let all = Array.from(this.runs.values()).filter((r) => r.tenantId === tenantId);
    if (filter.status) {
      all = all.filter((r) => r.status === filter.status);
    }
    if (filter.workflowId) {
      all = all.filter((r) => r.workflowId === filter.workflowId);
    }
    const total = all.length;
    const data = all.slice(pagination.offset, pagination.offset + pagination.limit);
    return { data, total, limit: pagination.limit, offset: pagination.offset };
  }
}

export class InMemoryWorkflowStepRepository implements IWorkflowStepRepository {
  public steps = new Map<string, WorkflowStepRecord>();
  public shouldFailNext = false;

  async create(input: CreateWorkflowStepInput): Promise<WorkflowStepRecord> {
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw new Error("Simulated persistence failure");
    }

    // Check unique composite key runId + stepKey
    for (const existing of this.steps.values()) {
      if (existing.runId === input.runId && existing.stepKey === input.stepKey) {
        throw new ConflictError(
          `Step "${input.stepKey}" already exists for run "${input.runId}"`,
          "uq_run_step_key"
        );
      }
    }

    const id = `step-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    const record: WorkflowStepRecord = {
      id,
      runId: input.runId,
      stepKey: input.stepKey,
      type: input.type,
      status: "PENDING",
      input: input.input ?? null,
      output: null,
      error: null,
      attempt: 1,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.steps.set(id, record);
    return record;
  }

  async findById(id: string): Promise<WorkflowStepRecord | null> {
    return this.steps.get(id) ?? null;
  }

  async findByRunAndKey(runId: string, stepKey: string): Promise<WorkflowStepRecord | null> {
    for (const step of this.steps.values()) {
      if (step.runId === runId && step.stepKey === stepKey) {
        return step;
      }
    }
    return null;
  }

  async update(id: string, input: UpdateWorkflowStepInput): Promise<WorkflowStepRecord> {
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw new Error("Simulated persistence failure");
    }

    const existing = this.steps.get(id);
    if (!existing) {
      throw new NotFoundError("WorkflowStep", id);
    }

    const updated: WorkflowStepRecord = {
      ...existing,
      status: input.status ?? existing.status,
      output: input.output !== undefined ? input.output : existing.output,
      error: input.error !== undefined ? input.error : existing.error,
      attempt: input.attempt ?? existing.attempt,
      startedAt: input.startedAt ?? existing.startedAt,
      completedAt: input.completedAt ?? existing.completedAt,
      updatedAt: new Date(),
    };

    this.steps.set(id, updated);
    return updated;
  }

  async listByRun(runId: string): Promise<readonly WorkflowStepRecord[]> {
    return Array.from(this.steps.values())
      .filter((s) => s.runId === runId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}

export class InMemoryWorkflowEventRepository implements IWorkflowEventRepository {
  public events: WorkflowEventRecord[] = [];

  async create(input: CreateWorkflowEventInput): Promise<WorkflowEventRecord> {
    const seq = await this.getLatestSequence(input.runId) + 1;
    const record: WorkflowEventRecord = {
      id: `evt-${Math.random().toString(36).substring(2, 9)}`,
      runId: input.runId,
      type: input.type,
      payload: input.payload ?? null,
      sequence: seq,
      createdAt: new Date(),
    };
    this.events.push(record);
    return record;
  }

  async listByRun(runId: string): Promise<readonly WorkflowEventRecord[]> {
    return this.events
      .filter((e) => e.runId === runId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  async getLatestSequence(runId: string): Promise<number> {
    const runEvents = this.events.filter((e) => e.runId === runId);
    if (runEvents.length === 0) return 0;
    return Math.max(...runEvents.map((e) => e.sequence));
  }
}
