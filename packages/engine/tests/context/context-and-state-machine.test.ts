import { describe, test, expect } from "bun:test";
import { WorkflowExecutionContext } from "../../src/context/execution-context";
import { DefaultStructuredLogger, type LogEntry } from "../../src/context/logger";
import {
  canTransitionRun,
  assertValidRunTransition,
  canTransitionStep,
  assertValidStepTransition,
  isTerminalRunStatus,
  isTerminalStepStatus,
} from "../../src/execution/state-machine";
import { InvalidStateTransitionError } from "../../src/errors/engine-errors";

describe("Execution Context & State Machine", () => {
  test("creates isolated context with proper properties and idempotencyKey", () => {
    const logs: LogEntry[] = [];
    const logger = new DefaultStructuredLogger(
      { tenantId: "t-1", runId: "r-1", stepId: "s-1", attempt: 2 },
      (entry) => logs.push(entry)
    );

    const stepOutputs = new Map<string, unknown>([
      ["s-0", { count: 42 }],
    ]);

    const ctx = new WorkflowExecutionContext({
      tenantId: "t-1",
      workflowId: "wf-1",
      runId: "r-1",
      stepId: "s-1",
      attempt: 2,
      signal: new AbortController().signal,
      workflowInput: { initial: "data" },
      stepOutputs,
      previousStepId: "s-0",
      logger,
    });

    expect(ctx.tenantId).toBe("t-1");
    expect(ctx.workflowId).toBe("wf-1");
    expect(ctx.runId).toBe("r-1");
    expect(ctx.stepId).toBe("s-1");
    expect(ctx.attempt).toBe(2);
    expect(ctx.idempotencyKey).toBe("t-1:wf-1:r-1:s-1:2");
    expect(ctx.workflowInput).toEqual({ initial: "data" });
    expect(ctx.previousOutput).toEqual({ count: 42 });
    expect(ctx.getStepOutput("s-0")).toEqual({ count: 42 });
    expect(ctx.getStepOutput("non-existent")).toBeUndefined();

    ctx.logger.info("Step running", { foo: "bar" });
    expect(logs.length).toBe(1);
    expect(logs[0]!.message).toBe("Step running");
    expect(logs[0]!.meta).toEqual({ foo: "bar" });
    expect(logs[0]!.stepId).toBe("s-1");
  });

  test("enforces run state transitions", () => {
    expect(canTransitionRun("PENDING", "RUNNING")).toBe(true);
    expect(canTransitionRun("RUNNING", "COMPLETED")).toBe(true);
    expect(canTransitionRun("RUNNING", "FAILED")).toBe(true);
    expect(canTransitionRun("RUNNING", "CANCELLED")).toBe(true);

    // Invalid transitions
    expect(canTransitionRun("COMPLETED", "RUNNING")).toBe(false);
    expect(canTransitionRun("CANCELLED", "RUNNING")).toBe(false);
    expect(canTransitionRun("FAILED", "RUNNING")).toBe(true); // Resumable

    expect(() => assertValidRunTransition("COMPLETED", "RUNNING")).toThrow(
      InvalidStateTransitionError
    );
    expect(() => assertValidRunTransition("PENDING", "COMPLETED")).toThrow(
      InvalidStateTransitionError
    );

    expect(isTerminalRunStatus("COMPLETED")).toBe(true);
    expect(isTerminalRunStatus("CANCELLED")).toBe(true);
    expect(isTerminalRunStatus("FAILED")).toBe(false); // Resumable
    expect(isTerminalRunStatus("RUNNING")).toBe(false);
    expect(isTerminalRunStatus("PENDING")).toBe(false);
  });

  test("enforces step state transitions", () => {
    expect(canTransitionStep("PENDING", "RUNNING")).toBe(true);
    expect(canTransitionStep("RUNNING", "COMPLETED")).toBe(true);
    expect(canTransitionStep("RUNNING", "FAILED")).toBe(true);
    expect(canTransitionStep("RUNNING", "PENDING")).toBe(true); // retry
    expect(canTransitionStep("FAILED", "PENDING")).toBe(true); // retry
    expect(canTransitionStep("FAILED", "RUNNING")).toBe(true); // resume

    // Terminal step states
    expect(canTransitionStep("COMPLETED", "RUNNING")).toBe(false);
    expect(canTransitionStep("SKIPPED", "RUNNING")).toBe(false);
    expect(canTransitionStep("CANCELLED", "RUNNING")).toBe(false);

    expect(() => assertValidStepTransition("COMPLETED", "RUNNING")).toThrow(
      InvalidStateTransitionError
    );

    expect(isTerminalStepStatus("COMPLETED")).toBe(true);
    expect(isTerminalStepStatus("SKIPPED")).toBe(true);
    expect(isTerminalStepStatus("CANCELLED")).toBe(true);
    expect(isTerminalStepStatus("RUNNING")).toBe(false);
    expect(isTerminalStepStatus("FAILED")).toBe(false);
  });
});
