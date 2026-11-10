import { describe, test, expect, beforeEach } from "bun:test";
import { WorkflowRegistry } from "../../src/registry/workflow-registry";
import { defineWorkflow } from "../../src/workflow/workflow";
import { WorkflowVersionError, ValidationError } from "../../src/errors/sdk-errors";

describe("WorkflowRegistry", () => {
  let registry: WorkflowRegistry;

  beforeEach(() => {
    registry = new WorkflowRegistry();
  });

  test("registers and retrieves a workflow by ID", () => {
    const wf = defineWorkflow(
      { id: "signup-flow", version: 1 },
      async () => "done"
    );

    registry.register(wf);
    expect(registry.has("signup-flow")).toBe(true);
    expect(registry.get("signup-flow")).toBe(wf);
  });

  test("resolves exact workflow ID and version", () => {
    const wfV1 = defineWorkflow(
      { id: "order-flow", version: 1, name: "Order Flow v1" },
      async () => "v1"
    );
    const wfV2 = defineWorkflow(
      { id: "order-flow", version: 2, name: "Order Flow v2" },
      async () => "v2"
    );

    registry.register(wfV1);
    registry.register(wfV2);

    expect(registry.get("order-flow", 1)?.name).toBe("Order Flow v1");
    expect(registry.get("order-flow", 2)?.name).toBe("Order Flow v2");
    // Latest registered is default fallback
    expect(registry.get("order-flow")?.name).toBe("Order Flow v2");
  });

  test("throws WorkflowVersionError when resolving unregistered version", () => {
    const wf = defineWorkflow(
      { id: "invoice-flow", version: 1 },
      async () => "done"
    );
    registry.register(wf);

    expect(() => registry.getOrThrow("invoice-flow", 99)).toThrow(WorkflowVersionError);
    expect(() => registry.getOrThrow("non-existent-flow")).toThrow(WorkflowVersionError);
  });

  test("idempotently handles identical duplicate registration", () => {
    const wf = defineWorkflow(
      { id: "dup-flow", version: 1 },
      async () => "ok"
    );

    registry.register(wf);
    // Should not throw on re-registering the same definition
    expect(() => registry.register(wf)).not.toThrow();
  });

  test("rejects conflicting duplicate registration with different metadata", () => {
    const wf1 = defineWorkflow(
      { id: "conflict-flow", version: 1, name: "Original Name" },
      async () => "ok"
    );
    const wf2 = defineWorkflow(
      { id: "conflict-flow", version: 1, name: "Conflicting Name" },
      async () => "ok"
    );

    registry.register(wf1);
    expect(() => registry.register(wf2)).toThrow(ValidationError);
  });

  test("multiple registry instances do not collide", () => {
    const registryA = new WorkflowRegistry();
    const registryB = new WorkflowRegistry();

    const wf = defineWorkflow({ id: "isolated-flow", version: 1 }, async () => "ok");
    registryA.register(wf);

    expect(registryA.has("isolated-flow")).toBe(true);
    expect(registryB.has("isolated-flow")).toBe(false);
  });

  test("lists all registered workflows and clears", () => {
    const wf1 = defineWorkflow({ id: "wf1", version: 1 }, async () => {});
    const wf2 = defineWorkflow({ id: "wf2", version: 1 }, async () => {});

    registry.register(wf1);
    registry.register(wf2);

    expect(registry.list()).toHaveLength(2);

    registry.clear();
    expect(registry.list()).toHaveLength(0);
    expect(registry.has("wf1")).toBe(false);
  });
});
