import type { WorkflowRunStatus, WorkflowStepStatus } from "@durable/storage";
import { InvalidStateTransitionError } from "../errors/engine-errors";

const VALID_RUN_TRANSITIONS: Readonly<Record<WorkflowRunStatus, readonly WorkflowRunStatus[]>> = {
  PENDING: ["RUNNING", "CANCELLED"],
  RUNNING: ["COMPLETED", "FAILED", "CANCELLED"],
  FAILED: ["RUNNING"], // Allows resuming/retrying a failed run
  COMPLETED: [],
  CANCELLED: [],
};

const VALID_STEP_TRANSITIONS: Readonly<Record<WorkflowStepStatus, readonly WorkflowStepStatus[]>> = {
  PENDING: ["RUNNING", "SKIPPED", "CANCELLED"],
  RUNNING: ["COMPLETED", "FAILED", "CANCELLED", "PENDING"],
  FAILED: ["RUNNING", "PENDING"], // Can retry or be resumed
  COMPLETED: [],
  SKIPPED: [],
  CANCELLED: [],
};

export function canTransitionRun(from: WorkflowRunStatus, to: WorkflowRunStatus): boolean {
  if (from === to) return true;
  return VALID_RUN_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidRunTransition(from: WorkflowRunStatus, to: WorkflowRunStatus): void {
  if (!canTransitionRun(from, to)) {
    throw new InvalidStateTransitionError("run", from, to);
  }
}

export function canTransitionStep(from: WorkflowStepStatus, to: WorkflowStepStatus): boolean {
  if (from === to) return true;
  return VALID_STEP_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidStepTransition(from: WorkflowStepStatus, to: WorkflowStepStatus): void {
  if (!canTransitionStep(from, to)) {
    throw new InvalidStateTransitionError("step", from, to);
  }
}

export function isTerminalRunStatus(status: WorkflowRunStatus): boolean {
  return VALID_RUN_TRANSITIONS[status]?.length === 0;
}

export function isTerminalStepStatus(status: WorkflowStepStatus): boolean {
  return status === "COMPLETED" || status === "SKIPPED" || status === "CANCELLED";
}
