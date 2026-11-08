import { describe, test, expect } from "bun:test";
import { defineWorkflow } from "../../src/definitions/define-workflow";
import { ExecutionEngine } from "../../src/execution/execution-engine";
import {
  InMemoryWorkflowRunRepository,
  InMemoryWorkflowStepRepository,
  InMemoryWorkflowEventRepository,
} from "../mocks/memory-repositories";
import {
  StepExecutionError,
  StepTimeoutError,
  WorkflowCancelledError,
} from "../../src/errors/engine-errors";

describe("ExecutionEngine Core Scenarios", () => {
  const noopSleep = async () => {};

  test("1 & 2 & 3 & 15: Executes sequential steps, passes output, persists output, provides idempotency metadata", async () => {
    const runRepo = new InMemoryWorkflowRunRepository();
    const stepRepo = new InMemoryWorkflowStepRepository();
    const eventRepo = new InMemoryWorkflowEventRepository();

    const engine = new ExecutionEngine({
      runRepo,
      stepRepo,
      eventRepo,
      sleepFn: noopSleep,
    });

    const idempotencyKeys: string[] = [];

    const workflow = defineWorkflow({
      name: "order-flow",
      version: 1,
      steps: [
        {
          id: "step-1",
          execute: async (ctx) => {
            idempotencyKeys.push(ctx.idempotencyKey);
            expect(ctx.workflowInput).toEqual({ orderId: "123" });
            return { validated: true, count: 10 };
          },
        },
        {
          id: "step-2",
          execute: async (ctx) => {
            idempotencyKeys.push(ctx.idempotencyKey);
            expect(ctx.previousOutput).toEqual({ validated: true, count: 10 });
            expect(ctx.getStepOutput("step-1")).toEqual({ validated: true, count: 10 });
            return { total: (ctx.previousOutput as any).count * 2 };
          },
        },
      ],
    });

    const result = await engine.start({
      tenantId: "tenant-a",
      workflowId: "wf-1",
      versionId: "ver-1",
      workflow,
      input: { orderId: "123" },
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.output).toEqual({ total: 20 });

    // Verify idempotency keys provided to each step
    expect(idempotencyKeys.length).toBe(2);
    expect(idempotencyKeys[0]).toBe(`tenant-a:wf-1:${result.runId}:step-1:1`);
    expect(idempotencyKeys[1]).toBe(`tenant-a:wf-1:${result.runId}:step-2:1`);

    // Verify persisted steps
    const steps = await stepRepo.listByRun(result.runId);
    expect(steps.length).toBe(2);
    expect(steps[0]!.status).toBe("COMPLETED");
    expect(steps[0]!.output).toEqual({ validated: true, count: 10 });
    expect(steps[1]!.status).toBe("COMPLETED");
    expect(steps[1]!.output).toEqual({ total: 20 });

    // Verify run record
    const run = await runRepo.findById("tenant-a", result.runId);
    expect(run?.status).toBe("COMPLETED");
    expect(run?.output).toEqual({ total: 20 });

    // Verify events emitted
    const events = await eventRepo.listByRun(result.runId);
    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain("run.started");
    expect(eventTypes).toContain("step.started");
    expect(eventTypes).toContain("step.completed");
    expect(eventTypes).toContain("run.completed");
  });

  test("4 & 5: Skips completed steps and resumes interrupted workflow", async () => {
    const runRepo = new InMemoryWorkflowRunRepository();
    const stepRepo = new InMemoryWorkflowStepRepository();
    const eventRepo = new InMemoryWorkflowEventRepository();

    const engine = new ExecutionEngine({
      runRepo,
      stepRepo,
      eventRepo,
      sleepFn: noopSleep,
    });

    let step1Executions = 0;
    let step2Executions = 0;
    let simulateCrashOnStep2 = true;

    const workflow = defineWorkflow({
      name: "crash-recovery-flow",
      version: 1,
      steps: [
        {
          id: "step-1",
          execute: async () => {
            step1Executions++;
            return { step1Done: true };
          },
        },
        {
          id: "step-2",
          execute: async (ctx) => {
            step2Executions++;
            if (simulateCrashOnStep2) {
              // Simulate process crash: step is marked RUNNING in storage, but process exits
              throw new Error("Simulated sudden process exit!");
            }
            return { step2Done: true, step1: ctx.getStepOutput("step-1") };
          },
          retry: { maxAttempts: 1 }, // don't retry in same process run
        },
        {
          id: "step-3",
          execute: async (ctx) => {
            return { allDone: true, previous: ctx.previousOutput };
          },
        },
      ],
    });

    // Start initial run
    const initialResult = await engine.start({
      tenantId: "tenant-a",
      workflowId: "wf-crash",
      versionId: "ver-1",
      workflow,
    });

    expect(initialResult.status).toBe("FAILED");
    expect(step1Executions).toBe(1);
    expect(step2Executions).toBe(1);

    // Verify step-1 was completed and step-2 was failed
    const step1 = await stepRepo.findByRunAndKey(initialResult.runId, "step-1");
    expect(step1?.status).toBe("COMPLETED");

    // NOW RESUME: simulated restart where crash condition is resolved
    simulateCrashOnStep2 = false;

    const resumeResult = await engine.resume(
      "tenant-a",
      initialResult.runId,
      workflow
    );

    expect(resumeResult.status).toBe("COMPLETED");
    // CRITICAL: Step 1 MUST NOT have been executed again!
    expect(step1Executions).toBe(1);
    // Step 2 executed again during resumption
    expect(step2Executions).toBe(2);

    expect(resumeResult.output).toEqual({
      allDone: true,
      previous: { step2Done: true, step1: { step1Done: true } },
    });
  });

  test("6 & 7: Retries a failed step and stops after max attempts", async () => {
    const runRepo = new InMemoryWorkflowRunRepository();
    const stepRepo = new InMemoryWorkflowStepRepository();
    const eventRepo = new InMemoryWorkflowEventRepository();

    const engine = new ExecutionEngine({
      runRepo,
      stepRepo,
      eventRepo,
      sleepFn: noopSleep,
    });

    let attempts = 0;

    const retryWorkflow = defineWorkflow({
      name: "retry-flow",
      version: 1,
      steps: [
        {
          id: "flaky-step",
          retry: { maxAttempts: 3, initialDelayMs: 10, jitter: false },
          execute: async () => {
            attempts++;
            if (attempts < 3) {
              throw new Error(`Transient error ${attempts}`);
            }
            return { success: true, attempts };
          },
        },
      ],
    });

    const result = await engine.start({
      tenantId: "tenant-a",
      workflowId: "wf-retry",
      versionId: "v-1",
      workflow: retryWorkflow,
    });

    expect(result.status).toBe("COMPLETED");
    expect(attempts).toBe(3);
    expect(result.output).toEqual({ success: true, attempts: 3 });

    // Now test exceeding max attempts
    let exhaustedAttempts = 0;
    const failWorkflow = defineWorkflow({
      name: "fail-flow",
      version: 1,
      steps: [
        {
          id: "always-fail-step",
          retry: { maxAttempts: 2, initialDelayMs: 10, jitter: false },
          execute: async () => {
            exhaustedAttempts++;
            throw new Error("Permanent error");
          },
        },
      ],
    });

    const failResult = await engine.start({
      tenantId: "tenant-a",
      workflowId: "wf-fail",
      versionId: "v-1",
      workflow: failWorkflow,
    });

    expect(failResult.status).toBe("FAILED");
    expect(exhaustedAttempts).toBe(2);
    const failStep = await stepRepo.findByRunAndKey(failResult.runId, "always-fail-step");
    expect(failStep?.status).toBe("FAILED");
    expect(failStep?.attempt).toBe(2);
  });

  test("8: Handles step timeout and propagates abort signal", async () => {
    const runRepo = new InMemoryWorkflowRunRepository();
    const stepRepo = new InMemoryWorkflowStepRepository();
    const eventRepo = new InMemoryWorkflowEventRepository();

    const engine = new ExecutionEngine({
      runRepo,
      stepRepo,
      eventRepo,
      sleepFn: noopSleep,
    });

    let observedAbort = false;

    const timeoutWorkflow = defineWorkflow({
      name: "timeout-flow",
      version: 1,
      steps: [
        {
          id: "slow-step",
          timeoutMs: 50,
          retry: { maxAttempts: 1 },
          execute: async (ctx) => {
            return new Promise((_, reject) => {
              const timer = setTimeout(() => {
                reject(new Error("Should not resolve"));
              }, 500);

              ctx.signal.addEventListener("abort", () => {
                clearTimeout(timer);
                observedAbort = true;
                reject(ctx.signal.reason);
              });
            });
          },
        },
      ],
    });

    const result = await engine.start({
      tenantId: "tenant-a",
      workflowId: "wf-timeout",
      versionId: "v-1",
      workflow: timeoutWorkflow,
    });

    expect(result.status).toBe("FAILED");
    expect(observedAbort).toBe(true);
    const step = await stepRepo.findByRunAndKey(result.runId, "slow-step");
    expect(step?.status).toBe("FAILED");
    expect((step?.error as any)?.message).toContain("timed out after 50ms");
  });

  test("9: Handles workflow cancellation and active step abort propagation", async () => {
    const runRepo = new InMemoryWorkflowRunRepository();
    const stepRepo = new InMemoryWorkflowStepRepository();
    const eventRepo = new InMemoryWorkflowEventRepository();

    const engine = new ExecutionEngine({
      runRepo,
      stepRepo,
      eventRepo,
      sleepFn: noopSleep,
    });

    let stepStarted = false;
    let step2Executed = false;

    const cancelWorkflow = defineWorkflow({
      name: "cancel-flow",
      version: 1,
      steps: [
        {
          id: "long-step",
          execute: async (ctx) => {
            stepStarted = true;
            return new Promise((resolve, reject) => {
              ctx.signal.addEventListener("abort", () => {
                reject(ctx.signal.reason);
              });
            });
          },
        },
        {
          id: "never-run-step",
          execute: async () => {
            step2Executed = true;
            return {};
          },
        },
      ],
    });

    const startPromise = engine.start({
      tenantId: "tenant-a",
      workflowId: "wf-cancel",
      versionId: "v-1",
      workflow: cancelWorkflow,
    });

    // Wait until step starts
    while (!stepStarted) {
      await new Promise((r) => setTimeout(r, 5));
    }

    // Cancel the workflow run
    const runId = Array.from(runRepo.runs.keys())[0]!.split(":")[1]!;
    await engine.cancel("tenant-a", runId);

    const result = await startPromise;
    expect(result.status).toBe("CANCELLED");
    expect(step2Executed).toBe(false);

    const run = await runRepo.findById("tenant-a", runId);
    expect(run?.status).toBe("CANCELLED");

    const step = await stepRepo.findByRunAndKey(runId, "long-step");
    expect(step?.status).toBe("CANCELLED");
  });

  test("12: Handles persistence failure gracefully", async () => {
    const runRepo = new InMemoryWorkflowRunRepository();
    const stepRepo = new InMemoryWorkflowStepRepository();

    const engine = new ExecutionEngine({
      runRepo,
      stepRepo,
      sleepFn: noopSleep,
    });

    const workflow = defineWorkflow({
      name: "storage-fail-flow",
      version: 1,
      steps: [
        {
          id: "step-1",
          execute: async () => ({ ok: true }),
        },
      ],
    });

    // Simulate failure during run creation
    runRepo.shouldFailNext = true;
    await expect(
      engine.start({
        tenantId: "tenant-a",
        workflowId: "wf-fail",
        versionId: "v-1",
        workflow,
      })
    ).rejects.toThrow("Simulated persistence failure");
  });

  test("13: Verifies tenant isolation", async () => {
    const runRepo = new InMemoryWorkflowRunRepository();
    const stepRepo = new InMemoryWorkflowStepRepository();

    const engine = new ExecutionEngine({
      runRepo,
      stepRepo,
      sleepFn: noopSleep,
    });

    const workflow = defineWorkflow({
      name: "isolation-flow",
      version: 1,
      steps: [
        {
          id: "step-1",
          execute: async (ctx) => ({ tenant: ctx.tenantId }),
        },
      ],
    });

    const run1 = await engine.start({
      tenantId: "tenant-1",
      workflowId: "wf-iso",
      versionId: "v-1",
      workflow,
    });

    const run2 = await engine.start({
      tenantId: "tenant-2",
      workflowId: "wf-iso",
      versionId: "v-1",
      workflow,
    });

    expect(run1.output).toEqual({ tenant: "tenant-1" });
    expect(run2.output).toEqual({ tenant: "tenant-2" });

    // tenant-1 cannot view or modify tenant-2 run
    const lookupCrossTenant = await runRepo.findById("tenant-1", run2.runId);
    expect(lookupCrossTenant).toBeNull();
  });

  test("14: Concurrent execution does not corrupt state", async () => {
    const runRepo = new InMemoryWorkflowRunRepository();
    const stepRepo = new InMemoryWorkflowStepRepository();

    const engine = new ExecutionEngine({
      runRepo,
      stepRepo,
      sleepFn: noopSleep,
    });

    const workflow = defineWorkflow({
      name: "concurrent-flow",
      version: 1,
      steps: [
        {
          id: "compute",
          execute: async (ctx) => {
            const input = ctx.workflowInput as { id: number };
            return { processed: input.id * 10 };
          },
        },
      ],
    });

    // Launch 10 concurrent runs
    const promises = Array.from({ length: 10 }).map((_, i) =>
      engine.start({
        tenantId: `tenant-${i}`,
        workflowId: "wf-concurrent",
        versionId: "v-1",
        workflow,
        input: { id: i },
      })
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(10);
    for (let i = 0; i < 10; i++) {
      expect(results[i]!.status).toBe("COMPLETED");
      expect(results[i]!.output).toEqual({ processed: i * 10 });
    }
  });
});
