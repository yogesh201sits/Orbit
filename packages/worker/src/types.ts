import type {
  PrismaClient,
  IWorkerRepository,
  IJobRepository,
  IWorkflowRunRepository,
  IWorkflowStepRepository,
  IWorkflowEventRepository,
  IWorkflowRepository,
  IWorkflowVersionRepository,
  JobRecord,
  WorkerRecord,
  Json,
} from "@durable/storage";
import type { ExecutionEngine, WorkflowDefinition } from "@durable/engine";

export type WorkerState =
  | "INITIALIZING"
  | "RUNNING"
  | "PAUSED"
  | "STOPPING"
  | "STOPPED";

export interface WorkerOptions {
  readonly client: PrismaClient;
  readonly workerRepo: IWorkerRepository;
  readonly jobRepo: IJobRepository;
  readonly runRepo?: IWorkflowRunRepository | undefined;
  readonly stepRepo?: IWorkflowStepRepository | undefined;
  readonly eventRepo?: IWorkflowEventRepository | undefined;
  readonly workflowRepo?: IWorkflowRepository | undefined;
  readonly versionRepo?: IWorkflowVersionRepository | undefined;
  readonly tenantId: string;
  readonly workerId?: string | undefined;
  readonly name?: string | undefined;
  readonly queues?: string[] | undefined;
  readonly concurrency?: number | undefined;
  readonly pollIntervalMs?: number | undefined;
  readonly leaseDurationMs?: number | undefined;
  readonly heartbeatIntervalMs?: number | undefined;
  readonly shutdownGracePeriodMs?: number | undefined;
  readonly staleWorkerTimeoutMs?: number | undefined;
  readonly autoRecoverLeases?: boolean | undefined;
  readonly recoveryIntervalMs?: number | undefined;
  readonly handleSignals?: boolean | undefined;
  readonly engine?: ExecutionEngine | undefined;
  readonly metadata?: Json | undefined;
}

export interface WorkerConfig {
  readonly tenantId: string;
  readonly workerId: string;
  readonly name: string;
  readonly queues: string[];
  readonly concurrency: number;
  readonly pollIntervalMs: number;
  readonly leaseDurationMs: number;
  readonly heartbeatIntervalMs: number;
  readonly shutdownGracePeriodMs: number;
  readonly staleWorkerTimeoutMs: number;
  readonly autoRecoverLeases: boolean;
  readonly recoveryIntervalMs: number;
  readonly handleSignals: boolean;
  readonly metadata?: Json | undefined;
}

export interface ActiveJobLease {
  readonly jobId: string;
  readonly tenantId: string;
  fencingToken: bigint;
  leaseExpiresAt: Date;
  readonly abortController: AbortController;
  readonly startedAt: Date;
}

export type JobHandler = (
  job: JobRecord,
  signal: AbortSignal
) => Promise<unknown>;

export interface WorkflowDispatchPayload {
  readonly workflowId?: string | undefined;
  readonly workflowKey?: string | undefined;
  readonly versionId?: string | undefined;
  readonly runId?: string | undefined;
  readonly scheduleId?: string | undefined;
  readonly input?: unknown;
  readonly scheduledFor?: string | undefined;
}

export interface JobExecutionResult {
  readonly jobId: string;
  readonly status: "COMPLETED" | "FAILED";
  readonly output?: unknown;
  readonly error?: unknown;
  readonly fencingToken: bigint;
}
