import { describe, expect, test } from "bun:test";

import {
  WORKFLOW_RUN_STATUSES,
  STEP_STATUSES,
  JOB_STATUSES,
  isTerminalRunStatus,
  isTerminalStepStatus
} from "./statuses";

describe("@durable/shared", () => {
  test("exports all workflow run statuses", () => {
    expect(WORKFLOW_RUN_STATUSES).toEqual([
      "pending",
      "running",
      "waiting",
      "completed",
      "failed",
      "cancelled",
      "timed_out"
    ]);
  });

  test("exports all step statuses", () => {
    expect(STEP_STATUSES).toEqual([
      "pending",
      "running",
      "completed",
      "failed",
      "cancelled"
    ]);
  });

  test("exports all job statuses", () => {
    expect(JOB_STATUSES).toEqual([
      "pending",
      "scheduled",
      "processing",
      "completed",
      "failed",
      "cancelled"
    ]);
  });

  test("identifies terminal workflow states", () => {
    expect(isTerminalRunStatus("completed")).toBe(true);
    expect(isTerminalRunStatus("failed")).toBe(true);
    expect(isTerminalRunStatus("cancelled")).toBe(true);
    expect(isTerminalRunStatus("timed_out")).toBe(true);

    expect(isTerminalRunStatus("pending")).toBe(false);
    expect(isTerminalRunStatus("running")).toBe(false);
    expect(isTerminalRunStatus("waiting")).toBe(false);
  });

  test("identifies terminal step states", () => {
    expect(isTerminalStepStatus("completed")).toBe(true);
    expect(isTerminalStepStatus("failed")).toBe(true);
    expect(isTerminalStepStatus("cancelled")).toBe(true);

    expect(isTerminalStepStatus("pending")).toBe(false);
    expect(isTerminalStepStatus("running")).toBe(false);
  });
});
