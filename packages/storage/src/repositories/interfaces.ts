import type { PrismaClient, Prisma } from "../generated/prisma/client";
import type {
  JobStatus,
  WorkerStatus,
  WorkflowRunStatus,
  WorkflowStepStatus,
} from "../generated/prisma/enums";

// ─── Common Types ─────────────────────────────────────────────────────

export type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export type Json = Prisma.InputJsonValue;

export interface PaginationParams {
  readonly limit: number;
  readonly offset: number;
}

export interface PaginatedResult<T> {
  readonly data: readonly T[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

// ─── Tenant Repository ───────────────────────────────────────────────

export interface CreateTenantInput {
  readonly name: string;
  readonly slug: string;
  readonly metadata?: Json;
}

export interface UpdateTenantInput {
  readonly name?: string;
  readonly metadata?: Json;
}

export interface TenantRecord {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly metadata: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ITenantRepository {
  create(input: CreateTenantInput, tx?: TransactionClient): Promise<TenantRecord>;
  findById(id: string, tx?: TransactionClient): Promise<TenantRecord | null>;
  findBySlug(slug: string, tx?: TransactionClient): Promise<TenantRecord | null>;
  update(id: string, input: UpdateTenantInput, tx?: TransactionClient): Promise<TenantRecord>;
  delete(id: string, tx?: TransactionClient): Promise<void>;
  list(pagination: PaginationParams, tx?: TransactionClient): Promise<PaginatedResult<TenantRecord>>;
}

// ─── Workflow Repository ─────────────────────────────────────────────

export interface CreateWorkflowInput {
  readonly tenantId: string;
  readonly key: string;
  readonly name: string;
  readonly metadata?: Json;
}

export interface UpdateWorkflowInput {
  readonly name?: string;
  readonly metadata?: Json;
}

export interface WorkflowRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly key: string;
  readonly name: string;
  readonly metadata: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IWorkflowRepository {
  create(input: CreateWorkflowInput, tx?: TransactionClient): Promise<WorkflowRecord>;
  findById(tenantId: string, id: string, tx?: TransactionClient): Promise<WorkflowRecord | null>;
  findByKey(tenantId: string, key: string, tx?: TransactionClient): Promise<WorkflowRecord | null>;
  update(tenantId: string, id: string, input: UpdateWorkflowInput, tx?: TransactionClient): Promise<WorkflowRecord>;
  delete(tenantId: string, id: string, tx?: TransactionClient): Promise<void>;
  list(tenantId: string, pagination: PaginationParams, tx?: TransactionClient): Promise<PaginatedResult<WorkflowRecord>>;
}

// ─── Workflow Version Repository ─────────────────────────────────────

export interface CreateWorkflowVersionInput {
  readonly workflowId: string;
  readonly version: number;
  readonly definition: Json;
  readonly checksum: string;
  readonly isActive?: boolean;
}

export interface WorkflowVersionRecord {
  readonly id: string;
  readonly workflowId: string;
  readonly version: number;
  readonly definition: unknown;
  readonly checksum: string;
  readonly isActive: boolean;
  readonly activatedAt: Date | null;
  readonly createdAt: Date;
}

export interface IWorkflowVersionRepository {
  create(input: CreateWorkflowVersionInput, tx?: TransactionClient): Promise<WorkflowVersionRecord>;
  findById(id: string, tx?: TransactionClient): Promise<WorkflowVersionRecord | null>;
  findByWorkflowAndVersion(workflowId: string, version: number, tx?: TransactionClient): Promise<WorkflowVersionRecord | null>;
  findActiveVersion(workflowId: string, tx?: TransactionClient): Promise<WorkflowVersionRecord | null>;
  activate(id: string, tx?: TransactionClient): Promise<WorkflowVersionRecord>;
  listByWorkflow(workflowId: string, pagination: PaginationParams, tx?: TransactionClient): Promise<PaginatedResult<WorkflowVersionRecord>>;
}

// ─── Workflow Run Repository ─────────────────────────────────────────

export interface CreateWorkflowRunInput {
  readonly tenantId: string;
  readonly workflowId: string;
  readonly versionId: string;
  readonly input?: Json;
}

export interface UpdateWorkflowRunInput {
  readonly status?: WorkflowRunStatus;
  readonly output?: Json;
  readonly error?: Json;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
}

export interface WorkflowRunRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly workflowId: string;
  readonly versionId: string;
  readonly status: WorkflowRunStatus;
  readonly input: unknown;
  readonly output: unknown;
  readonly error: unknown;
  readonly revision: number;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ListRunsFilter {
  readonly status?: WorkflowRunStatus;
  readonly workflowId?: string;
}

export interface IWorkflowRunRepository {
  create(input: CreateWorkflowRunInput, tx?: TransactionClient): Promise<WorkflowRunRecord>;
  findById(tenantId: string, id: string, tx?: TransactionClient): Promise<WorkflowRunRecord | null>;
  /**
   * Updates a workflow run with optimistic concurrency control.
   * @param expectedRevision - The revision the caller expects the row to have.
   * @throws StaleRevisionError if the current revision != expectedRevision.
   */
  update(
    tenantId: string,
    id: string,
    input: UpdateWorkflowRunInput,
    expectedRevision: number,
    tx?: TransactionClient,
  ): Promise<WorkflowRunRecord>;
  list(
    tenantId: string,
    filter: ListRunsFilter,
    pagination: PaginationParams,
    tx?: TransactionClient,
  ): Promise<PaginatedResult<WorkflowRunRecord>>;
}

// ─── Workflow Step Repository ────────────────────────────────────────

export interface CreateWorkflowStepInput {
  readonly runId: string;
  readonly stepKey: string;
  readonly type: string;
  readonly input?: Json;
}

export interface UpdateWorkflowStepInput {
  readonly status?: WorkflowStepStatus;
  readonly output?: Json;
  readonly error?: Json;
  readonly attempt?: number;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
}

export interface WorkflowStepRecord {
  readonly id: string;
  readonly runId: string;
  readonly stepKey: string;
  readonly type: string;
  readonly status: WorkflowStepStatus;
  readonly input: unknown;
  readonly output: unknown;
  readonly error: unknown;
  readonly attempt: number;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IWorkflowStepRepository {
  create(input: CreateWorkflowStepInput, tx?: TransactionClient): Promise<WorkflowStepRecord>;
  findById(id: string, tx?: TransactionClient): Promise<WorkflowStepRecord | null>;
  findByRunAndKey(runId: string, stepKey: string, tx?: TransactionClient): Promise<WorkflowStepRecord | null>;
  update(id: string, input: UpdateWorkflowStepInput, tx?: TransactionClient): Promise<WorkflowStepRecord>;
  listByRun(runId: string, tx?: TransactionClient): Promise<readonly WorkflowStepRecord[]>;
}

// ─── Workflow Event Repository ───────────────────────────────────────

export interface CreateWorkflowEventInput {
  readonly runId: string;
  readonly type: string;
  readonly payload?: Json;
}

export interface WorkflowEventRecord {
  readonly id: string;
  readonly runId: string;
  readonly type: string;
  readonly payload: unknown;
  readonly sequence: number;
  readonly createdAt: Date;
}

export interface IWorkflowEventRepository {
  create(input: CreateWorkflowEventInput, tx?: TransactionClient): Promise<WorkflowEventRecord>;
  listByRun(runId: string, tx?: TransactionClient): Promise<readonly WorkflowEventRecord[]>;
  getLatestSequence(runId: string, tx?: TransactionClient): Promise<number>;
}

// ─── Job Repository ──────────────────────────────────────────────────

export interface CreateJobInput {
  readonly tenantId: string;
  readonly queue: string;
  readonly type: string;
  readonly payload: Json;
  readonly priority?: number;
  readonly maxRetries?: number;
  readonly scheduledAt?: Date;
}

export interface UpdateJobInput {
  readonly status?: JobStatus;
  readonly error?: Json;
  readonly retryCount?: number;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly expectedFencingToken?: bigint;
}

export interface JobRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly queue: string;
  readonly type: string;
  readonly payload: unknown;
  readonly status: JobStatus;
  readonly priority: number;
  readonly maxRetries: number;
  readonly retryCount: number;
  readonly scheduledAt: Date;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly error: unknown;
  readonly leaseOwner: string | null;
  readonly leaseExpiresAt: Date | null;
  readonly fencingToken: bigint;
  readonly claimedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IJobRepository {
  create(input: CreateJobInput, tx?: TransactionClient): Promise<JobRecord>;
  findById(tenantId: string, id: string, tx?: TransactionClient): Promise<JobRecord | null>;
  update(tenantId: string, id: string, input: UpdateJobInput, tx?: TransactionClient): Promise<JobRecord>;
  /**
   * Claims the next available job and assigns a lease and fencing token.
   */
  dequeue(
    tenantId: string,
    queues: string[],
    workerId: string,
    leaseDurationMs?: number,
    tx?: TransactionClient
  ): Promise<JobRecord | null>;
  recoverExpiredLeases(tx?: TransactionClient): Promise<number>;
  listByQueue(tenantId: string, queue: string, pagination: PaginationParams, tx?: TransactionClient): Promise<PaginatedResult<JobRecord>>;
}

// ─── Worker Repository ──────────────────────────────────────────────

export interface CreateWorkerInput {
  readonly tenantId: string;
  readonly name: string;
  readonly queues: string[];
  readonly metadata?: Json;
}

export interface WorkerRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly queues: string[];
  readonly status: WorkerStatus;
  readonly lastHeartbeat: Date | null;
  readonly metadata: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IWorkerRepository {
  create(input: CreateWorkerInput, tx?: TransactionClient): Promise<WorkerRecord>;
  findById(tenantId: string, id: string, tx?: TransactionClient): Promise<WorkerRecord | null>;
  heartbeat(tenantId: string, id: string, tx?: TransactionClient): Promise<WorkerRecord>;
  deactivate(tenantId: string, id: string, tx?: TransactionClient): Promise<WorkerRecord>;
  listActive(tenantId: string, tx?: TransactionClient): Promise<readonly WorkerRecord[]>;
}

// ─── Outbox Repository ──────────────────────────────────────────────

export interface CreateOutboxEventInput {
  readonly tenantId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Json;
}

export interface OutboxEventRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: unknown;
  readonly published: boolean;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
}

export interface IOutboxRepository {
  create(input: CreateOutboxEventInput, tx?: TransactionClient): Promise<OutboxEventRecord>;
  /**
   * Fetches and marks a batch of unpublished events as published.
   */
  fetchUnpublished(batchSize: number, tx?: TransactionClient): Promise<readonly OutboxEventRecord[]>;
  markPublished(ids: string[], tx?: TransactionClient): Promise<void>;
}
