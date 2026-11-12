export type WorkflowRunStatus =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";

export type WorkflowStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelled";

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkerStatus = "active" | "paused" | "inactive";

export type ScheduleStatus = "active" | "paused" | "cancelled";

export type MissedExecutionPolicy = "skip" | "catch_up" | "latest";

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
}

export interface WorkflowItem {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  runsCount?: number;
  latestVersion?: number;
}

export interface WorkflowVersionItem {
  id: string;
  workflowId: string;
  version: number;
  definition: Record<string, unknown>;
  checksum: string;
  isActive: boolean;
  activatedAt?: string | null;
  createdAt: string;
  runsCount?: number;
}

export interface WorkflowRunItem {
  id: string;
  tenantId: string;
  workflowId: string;
  workflowKey?: string;
  workflowName?: string;
  versionId: string;
  versionNumber?: number;
  status: WorkflowRunStatus;
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  error?: {
    message?: string;
    stack?: string;
    code?: string;
    details?: unknown;
  } | null;
  revision: number;
  idempotencyKey?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  durationMs?: number | null;
  triggerType?: "manual" | "api" | "schedule" | "event";
}

export interface WorkflowStepItem {
  id: string;
  runId: string;
  stepKey: string;
  type: string;
  status: WorkflowStepStatus;
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  error?: {
    message?: string;
    stack?: string;
    code?: string;
  } | null;
  attempt: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  durationMs?: number | null;
}

export interface WorkflowEventItem {
  id: string;
  runId: string;
  type: string;
  payload?: Record<string, unknown> | null;
  sequence: number;
  createdAt: string;
}

export interface ScheduleItem {
  id: string;
  tenantId: string;
  workflowId: string;
  workflowName?: string;
  workflowKey?: string;
  cronExpression?: string | null;
  timezone: string;
  input?: Record<string, unknown> | null;
  missedExecutionPolicy: MissedExecutionPolicy;
  status: ScheduleStatus;
  nextRunAt: string;
  lastRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerItem {
  id: string;
  tenantId: string;
  name: string;
  hostname?: string;
  queues: string[];
  status: WorkerStatus;
  lastHeartbeat?: string | null;
  metadata?: {
    version?: string;
    concurrency?: number;
    activeJobs?: number;
    os?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  revokedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  plainTextKey?: string;
}

export interface OverviewMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  runningExecutions: number;
  registeredWorkflows: number;
  activeWorkers: number;
  successRate: number;
  chartData: Array<{
    timestamp: string;
    total: number;
    success: number;
    failed: number;
  }>;
}
