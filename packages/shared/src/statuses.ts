export const WORKFLOW_RUN_STATUSES = [
  "pending",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled",
  "timed_out"
] as const;

export type WorkflowRunStatus =
  (typeof WORKFLOW_RUN_STATUSES)[number];

export const STEP_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled"
] as const;

export type StepStatus = (typeof STEP_STATUSES)[number];

export const JOB_STATUSES = [
  "pending",
  "scheduled",
  "processing",
  "completed",
  "failed",
  "cancelled"
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

const TERMINAL_RUN_STATUSES = new Set<WorkflowRunStatus>([
  "completed",
  "failed",
  "cancelled",
  "timed_out"
]);

export function isTerminalRunStatus(
  status: WorkflowRunStatus
): boolean {
  return TERMINAL_RUN_STATUSES.has(status);
}

export function isTerminalStepStatus(
  status: StepStatus
): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled"
  );
}
