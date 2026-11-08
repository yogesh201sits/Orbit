import { describe, test, expect } from "bun:test";
import { defineWorkflow } from "../../src/definitions/define-workflow";
import { WorkflowValidationError } from "../../src/errors/engine-errors";

describe("Workflow Definition & Validation", () => {
  test("defines a valid workflow with multiple steps", () => {
    const wf = defineWorkflow({
      name: "order-processing",
      version: 1,
      steps: [
        {
          id: "validate-order",
          execute: async () => ({ valid: true }),
        },
        {
          id: "charge-card",
          retry: { maxAttempts: 3, initialDelayMs: 500 },
          timeoutMs: 5000,
          execute: async (ctx) => ({
            txnId: "txn_123",
            previous: ctx.previousOutput,
          }),
        },
      ],
    });

    expect(wf.name).toBe("order-processing");
    expect(wf.version).toBe(1);
    expect(wf.steps.length).toBe(2);
    expect(wf.steps[0]!.id).toBe("validate-order");
    expect(wf.steps[1]!.id).toBe("charge-card");
    expect(Object.isFrozen(wf)).toBe(true);
    expect(Object.isFrozen(wf.steps)).toBe(true);
  });

  test("rejects empty workflow name", () => {
    expect(() =>
      defineWorkflow({
        name: "",
        version: 1,
        steps: [{ id: "step-1", execute: async () => {} }],
      })
    ).toThrow(WorkflowValidationError);
  });

  test("rejects invalid workflow version", () => {
    expect(() =>
      defineWorkflow({
        name: "test-wf",
        version: 0,
        steps: [{ id: "step-1", execute: async () => {} }],
      })
    ).toThrow(WorkflowValidationError);

    expect(() =>
      defineWorkflow({
        name: "test-wf",
        version: -1,
        steps: [{ id: "step-1", execute: async () => {} }],
      })
    ).toThrow(WorkflowValidationError);
  });

  test("rejects workflow without steps", () => {
    expect(() =>
      defineWorkflow({
        name: "test-wf",
        version: 1,
        steps: [] as any,
      })
    ).toThrow(WorkflowValidationError);
  });

  test("rejects duplicate step IDs", () => {
    expect(() =>
      defineWorkflow({
        name: "dup-steps",
        version: 1,
        steps: [
          { id: "step-1", execute: async () => {} },
          { id: "step-2", execute: async () => {} },
          { id: "step-1", execute: async () => {} },
        ],
      })
    ).toThrow(WorkflowValidationError);

    try {
      defineWorkflow({
        name: "dup-steps",
        version: 1,
        steps: [
          { id: "step-1", execute: async () => {} },
          { id: "step-1", execute: async () => {} },
        ],
      });
    } catch (err: any) {
      expect(err).toBeInstanceOf(WorkflowValidationError);
      expect(err.message).toContain("Duplicate step id \"step-1\"");
    }
  });

  test("rejects invalid step id characters", () => {
    expect(() =>
      defineWorkflow({
        name: "test-wf",
        version: 1,
        steps: [{ id: "step with spaces", execute: async () => {} }],
      })
    ).toThrow(WorkflowValidationError);
  });

  test("rejects invalid timeout or retry configurations", () => {
    expect(() =>
      defineWorkflow({
        name: "test-wf",
        version: 1,
        steps: [
          {
            id: "step-1",
            timeoutMs: -50,
            execute: async () => {},
          },
        ],
      })
    ).toThrow(WorkflowValidationError);

    expect(() =>
      defineWorkflow({
        name: "test-wf",
        version: 1,
        steps: [
          {
            id: "step-1",
            retry: { maxAttempts: 0 },
            execute: async () => {},
          },
        ],
      })
    ).toThrow(WorkflowValidationError);
  });
});
