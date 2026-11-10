import { describe, test, expect } from "bun:test";
import { z } from "zod";
import { defineWorkflow } from "../../src/workflow/workflow";
import { ValidationError } from "../../src/errors/sdk-errors";

describe("Workflow Definition & Options Validation", () => {
  test("defines a valid workflow with typed handler", () => {
    const wf = defineWorkflow(
      {
        id: "process-order",
        version: 1,
        name: "Process Order Workflow",
        description: "Processes customer orders",
        metadata: { team: "billing" },
      },
      async ({ input, step }) => {
        return { ok: true };
      }
    );

    expect(wf.id).toBe("process-order");
    expect(wf.version).toBe(1);
    expect(wf.name).toBe("Process Order Workflow");
    expect(wf.description).toBe("Processes customer orders");
    expect(wf.metadata).toEqual({ team: "billing" });
    expect(typeof wf.handler).toBe("function");

    // Check definition is frozen / immutable
    expect(Object.isFrozen(wf)).toBe(true);
  });

  test("defaults name to id when name is not provided", () => {
    const wf = defineWorkflow(
      {
        id: "send-email",
        version: 1,
      },
      async () => "done"
    );

    expect(wf.name).toBe("send-email");
  });

  test("rejects missing or empty workflow ID", () => {
    expect(() =>
      defineWorkflow(
        { id: "", version: 1 } as any,
        async () => {}
      )
    ).toThrow(ValidationError);
  });

  test("rejects invalid characters in workflow ID", () => {
    expect(() =>
      defineWorkflow(
        { id: "invalid id with spaces", version: 1 },
        async () => {}
      )
    ).toThrow(ValidationError);

    expect(() =>
      defineWorkflow(
        { id: "invalid/slash", version: 1 },
        async () => {}
      )
    ).toThrow(ValidationError);
  });

  test("rejects invalid version numbers", () => {
    expect(() =>
      defineWorkflow(
        { id: "test", version: 0 },
        async () => {}
      )
    ).toThrow(ValidationError);

    expect(() =>
      defineWorkflow(
        { id: "test", version: -2 },
        async () => {}
      )
    ).toThrow(ValidationError);

    expect(() =>
      defineWorkflow(
        { id: "test", version: 1.5 },
        async () => {}
      )
    ).toThrow(ValidationError);
  });

  test("rejects missing handler function", () => {
    expect(() =>
      defineWorkflow(
        { id: "test", version: 1 },
        null as any
      )
    ).toThrow(ValidationError);
  });

  test("validates input using Zod schema at runtime", async () => {
    const InputSchema = z.object({
      orderId: z.string().min(3),
      amount: z.number().positive(),
    });

    const wf = defineWorkflow(
      {
        id: "validated-order",
        version: 1,
        inputSchema: InputSchema,
      },
      async ({ input }) => {
        return { processed: input.orderId, amount: input.amount };
      }
    );

    const engineDef = wf.toEngineDefinition();
    expect(typeof engineDef.handler).toBe("function");

    // Passing invalid input should throw ValidationError
    await expect(
      engineDef.handler!({
        input: { orderId: "x", amount: -5 } as any,
        step: { run: async () => {} } as any,
        context: { runId: "r1" } as any,
      })
    ).rejects.toThrow(ValidationError);

    // Passing valid input should succeed
    const res = await engineDef.handler!({
      input: { orderId: "ord_123", amount: 99.9 },
      step: { run: async () => {} } as any,
      context: { runId: "r1" } as any,
    });
    expect(res).toEqual({ processed: "ord_123", amount: 99.9 });
  });

  test("validates output using Zod schema at runtime", async () => {
    const OutputSchema = z.object({
      status: z.enum(["SUCCESS", "FAILED"]),
    });

    const wf = defineWorkflow(
      {
        id: "output-validated",
        version: 1,
        outputSchema: OutputSchema,
      },
      async () => {
        return { status: "INVALID_STATUS" as any };
      }
    );

    const engineDef = wf.toEngineDefinition();

    await expect(
      engineDef.handler!({
        input: {},
        step: { run: async () => {} } as any,
        context: { runId: "r1" } as any,
      })
    ).rejects.toThrow(ValidationError);
  });

  test("toMetadataPayload produces safe JSON without executable code", () => {
    const wf = defineWorkflow(
      {
        id: "metadata-test",
        version: 2,
        name: "Metadata Test",
        description: "Checks payload",
        metadata: { env: "prod" },
      },
      async () => "result"
    );

    const payload = wf.toMetadataPayload();
    expect(payload.key).toBe("metadata-test");
    expect(payload.name).toBe("Metadata Test");
    expect(payload.metadata).toEqual({ env: "prod" });
    expect(payload.version.version).toBe(2);
    expect(payload.version.isActive).toBe(true);
    expect(typeof payload.version.checksum).toBe("string");
    expect(payload.version.checksum!.length).toBe(64); // SHA-256

    // Confirm no functions or handlers are leaked into the metadata payload
    const jsonString = JSON.stringify(payload);
    expect(jsonString).not.toContain("async");
    expect(jsonString).not.toContain("function");
  });
});
