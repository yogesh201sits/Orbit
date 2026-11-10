import { describe, test, expect } from "bun:test";
import { createStepContext } from "../../src/execution/step-context";
import { StepCancelledError, ValidationError } from "../../src/errors/sdk-errors";

describe("Step Execution & Idempotency", () => {
  test("generates stable idempotency key without attempt number", async () => {
    let capturedIdempotencyKey: string | undefined;

    const mockEngineStep = {
      run: async (id: string, cb: () => any, opts: any) => {
        capturedIdempotencyKey = opts?.metadata?.idempotencyKey;
        return await cb();
      },
    };

    const ctx = createStepContext({
      tenantId: "tenant_abc",
      workflowId: "order_workflow",
      runId: "run_123",
      signal: new AbortController().signal,
      engineStep: mockEngineStep,
    });

    const result = await ctx.run("charge-payment", async () => {
      return { charged: 50 };
    });

    expect(result).toEqual({ charged: 50 });
    // Stable logical idempotency key: tenantId:workflowId:runId:stepId
    expect(capturedIdempotencyKey).toBe("tenant_abc:order_workflow:run_123:charge-payment");
    expect(capturedIdempotencyKey).not.toContain(":attempt");
  });

  test("different runs receive different idempotency keys", async () => {
    const keys: string[] = [];

    const mockEngineStep = {
      run: async (id: string, cb: () => any, opts: any) => {
        keys.push(opts?.metadata?.idempotencyKey);
        return await cb();
      },
    };

    const ctx1 = createStepContext({
      tenantId: "t1",
      workflowId: "wf1",
      runId: "run_aaa",
      signal: new AbortController().signal,
      engineStep: mockEngineStep,
    });

    const ctx2 = createStepContext({
      tenantId: "t1",
      workflowId: "wf1",
      runId: "run_bbb",
      signal: new AbortController().signal,
      engineStep: mockEngineStep,
    });

    await ctx1.run("step1", () => "res1");
    await ctx2.run("step1", () => "res2");

    expect(keys[0]).toBe("t1:wf1:run_aaa:step1");
    expect(keys[1]).toBe("t1:wf1:run_bbb:step1");
    expect(keys[0]).not.toBe(keys[1]);
  });

  test("rejects invalid step IDs", async () => {
    const ctx = createStepContext({
      tenantId: "t1",
      workflowId: "wf1",
      runId: "r1",
      signal: new AbortController().signal,
      engineStep: { run: async () => {} },
    });

    await expect(ctx.run("", () => {})).rejects.toThrow(ValidationError);
    await expect(ctx.run("invalid id with space", () => {})).rejects.toThrow(ValidationError);
  });

  test("aborts immediately when signal is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();

    const ctx = createStepContext({
      tenantId: "t1",
      workflowId: "wf1",
      runId: "r1",
      signal: controller.signal,
      engineStep: { run: async () => {} },
    });

    await expect(ctx.run("step1", () => "val")).rejects.toThrow(StepCancelledError);
  });

  test("recovers completed step output without re-executing callback", async () => {
    let callbackExecuted = false;

    // Simulate engine returning persisted output for completed step
    const mockEngineStep = {
      run: async (id: string, cb: () => any) => {
        if (id === "completed-step") {
          // Already completed in DB! Do not call cb()
          return { cached: true, value: 42 };
        }
        return await cb();
      },
    };

    const ctx = createStepContext({
      tenantId: "t1",
      workflowId: "wf1",
      runId: "r1",
      signal: new AbortController().signal,
      engineStep: mockEngineStep,
    });

    const result = await ctx.run("completed-step", async () => {
      callbackExecuted = true;
      return { cached: false, value: 0 };
    });

    expect(result).toEqual({ cached: true, value: 42 });
    expect(callbackExecuted).toBe(false);
  });
});
