import { describe, test, expect } from "bun:test";
import { createStepContext } from "../../src/execution/step-context";
import { defineWorkflow } from "../../src/workflow/workflow";
import { ValidationError } from "../../src/errors/sdk-errors";

describe("Durable Step Primitives", () => {
  const mockEngineStep = {
    run: async (id: string, cb: () => any, opts: any) => {
      return await cb();
    },
  };

  test("step.sleep parses human durations and executes as sleep step", async () => {
    let capturedType: string | undefined;
    let capturedDurationMs: number | undefined;

    const mockEngine = {
      run: async (id: string, cb: () => any, opts: any) => {
        capturedType = opts?.type;
        capturedDurationMs = opts?.metadata?.durationMs;
        return await cb();
      },
    };

    const ctx = createStepContext({
      tenantId: "t1",
      workflowId: "wf1",
      runId: "r1",
      signal: new AbortController().signal,
      engineStep: mockEngine,
    });

    const start = Date.now();
    await ctx.sleep("wait-step", "10ms");
    const elapsed = Date.now() - start;

    expect(capturedType).toBe("sleep");
    expect(capturedDurationMs).toBe(10);
    expect(elapsed).toBeGreaterThanOrEqual(8);
  });

  test("step.waitForEvent persists waiting state with metadata", async () => {
    let capturedMetadata: any;

    const mockEngine = {
      run: async (id: string, cb: () => any, opts: any) => {
        capturedMetadata = opts?.metadata;
        return await cb();
      },
    };

    const ctx = createStepContext({
      tenantId: "t1",
      workflowId: "wf1",
      runId: "r1",
      signal: new AbortController().signal,
      engineStep: mockEngine,
    });

    const result = await ctx.waitForEvent("wait-for-approval", {
      event: "order.approved",
      timeout: "1h",
      correlationKey: "ord_999",
    });

    expect(result).toHaveProperty("event", "order.approved");
    expect(capturedMetadata).toEqual({
      event: "order.approved",
      correlationKey: "ord_999",
    });
  });

  test("step.emit persists event emission without duplication", async () => {
    let capturedPayload: any;

    const mockEngine = {
      run: async (id: string, cb: () => any, opts: any) => {
        capturedPayload = await cb();
        return capturedPayload;
      },
    };

    const ctx = createStepContext({
      tenantId: "t1",
      workflowId: "wf1",
      runId: "r1",
      signal: new AbortController().signal,
      engineStep: mockEngine,
    });

    await ctx.emit("order.shipped", { trackingNumber: "TRK_123" }, { correlationKey: "ord_999" });

    expect(capturedPayload).toEqual({
      event: "order.shipped",
      payload: { trackingNumber: "TRK_123" },
      correlationKey: "ord_999",
      emittedAt: expect.any(String),
    });
  });

  test("step.parallel executes concurrent tasks preserving typed results", async () => {
    const ctx = createStepContext({
      tenantId: "t1",
      workflowId: "wf1",
      runId: "r1",
      signal: new AbortController().signal,
      engineStep: mockEngineStep,
    });

    const [user, preferences] = await ctx.parallel([
      () => ctx.run("fetch-user", async () => ({ id: "u1", name: "Alice" })),
      () => ctx.run("fetch-prefs", async () => ({ theme: "dark" })),
    ]);

    expect(user).toEqual({ id: "u1", name: "Alice" });
    expect(preferences).toEqual({ theme: "dark" });
  });

  test("step.compensate registers compensations and executes in reverse order on failure", async () => {
    const executedCompensations: string[] = [];

    const mockEngine = {
      run: async (id: string, cb: () => any) => {
        if (id === "failing-step") {
          throw new Error("Simulated failure triggering compensation");
        }
        return await cb();
      },
    };

    const ctx = createStepContext({
      tenantId: "t1",
      workflowId: "wf1",
      runId: "r1",
      signal: new AbortController().signal,
      engineStep: mockEngine,
    });

    await ctx.run("reserve-inventory", async () => "inventory reserved");
    ctx.compensate("release-inventory", async () => {
      executedCompensations.push("release-inventory");
    });

    await ctx.run("charge-credit-card", async () => "charged");
    ctx.compensate("refund-credit-card", async () => {
      executedCompensations.push("refund-credit-card");
    });

    // Failing step should trigger compensations in reverse (LIFO) order
    await expect(ctx.run("failing-step", async () => "will fail")).rejects.toThrow(
      "Simulated failure triggering compensation"
    );

    // Assert reverse order: refund-credit-card executed first, then release-inventory
    expect(executedCompensations).toEqual([
      "refund-credit-card",
      "release-inventory",
    ]);
  });

  test("step.child invokes child workflow correctly", async () => {
    const childWorkflow = defineWorkflow<{ amount: number }, { total: number }>(
      { id: "child-calc", version: 1 },
      async ({ input }) => {
        return { total: input.amount * 2 };
      }
    );

    const ctx = createStepContext({
      tenantId: "t1",
      workflowId: "parent-wf",
      runId: "parent_run_1",
      signal: new AbortController().signal,
      engineStep: mockEngineStep,
    });

    const result = await ctx.child("calc-step", childWorkflow, { amount: 25 });
    expect(result).toEqual({ total: 50 });
  });
});
