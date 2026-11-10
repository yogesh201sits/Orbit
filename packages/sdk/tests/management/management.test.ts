import { describe, test, expect, mock } from "bun:test";
import { Orbit } from "../../src/client/orbit";

describe("Typed Management Client", () => {
  const orbit = new Orbit({
    apiKey: "test-api-key",
    baseUrl: "http://localhost:3000",
  });

  test("runs.create sends correct route, headers and payload", async () => {
    let capturedUrl: string | undefined;
    let capturedBody: any;
    let capturedIdempotencyHeader: string | undefined;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (url: any, init: any) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(init.body);
      capturedIdempotencyHeader = new Headers(init.headers).get("Idempotency-Key") ?? undefined;

      return new Response(
        JSON.stringify({
          data: {
            id: "run-123",
            workflowId: "wf-order",
            versionId: "ver-1",
            status: "PENDING",
            revision: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          isIdempotentReplay: false,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }) as any;

    try {
      const result = await orbit.runs.create("wf-order", {
        versionId: "ver-1",
        input: { orderId: "ord_100" },
        idempotencyKey: "order_ord_100",
      });

      expect(capturedUrl).toContain("/v1/workflows/wf-order/runs");
      expect(capturedBody).toEqual({ versionId: "ver-1", input: { orderId: "ord_100" } });
      expect(capturedIdempotencyHeader).toBe("order_ord_100");
      expect(result.run.id).toBe("run-123");
      expect(result.isIdempotentReplay).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("runs.get, cancel, retry, steps, and events hit expected endpoints", async () => {
    const requestedPaths: string[] = [];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (url: any) => {
      const path = new URL(String(url)).pathname;
      requestedPaths.push(path);
      return new Response(JSON.stringify({ data: { id: "run-123", status: "COMPLETED" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any;

    try {
      await orbit.runs.get("run-123");
      await orbit.runs.cancel("run-123");
      await orbit.runs.retry("run-123");
      await orbit.runs.steps("run-123");
      await orbit.runs.events("run-123");

      expect(requestedPaths).toContain("/v1/runs/run-123");
      expect(requestedPaths).toContain("/v1/runs/run-123/cancel");
      expect(requestedPaths).toContain("/v1/runs/run-123/retry");
      expect(requestedPaths).toContain("/v1/runs/run-123/steps");
      expect(requestedPaths).toContain("/v1/runs/run-123/events");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("workflows CRUD and version management hits expected endpoints", async () => {
    const requestedMethods: string[] = [];
    const requestedPaths: string[] = [];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (url: any, init: any) => {
      requestedMethods.push(init.method);
      requestedPaths.push(new URL(String(url)).pathname);
      return new Response(JSON.stringify({ data: { id: "wf-123", key: "test-flow" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any;

    try {
      await orbit.workflows.create({ key: "my-flow", name: "My Flow" });
      await orbit.workflows.get("wf-123");
      await orbit.workflows.update("wf-123", { name: "Updated Name" });
      await orbit.workflows.createVersion("wf-123", {
        version: 1,
        definition: { steps: [] },
      });
      await orbit.workflows.activateVersion("wf-123", "ver-1");
      await orbit.workflows.delete("wf-123");

      expect(requestedPaths).toContain("/v1/workflows");
      expect(requestedPaths).toContain("/v1/workflows/wf-123");
      expect(requestedPaths).toContain("/v1/workflows/wf-123/versions");
      expect(requestedPaths).toContain("/v1/workflows/wf-123/versions/ver-1/activate");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("schedules CRUD operations hit expected endpoints", async () => {
    const requestedPaths: string[] = [];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (url: any) => {
      requestedPaths.push(new URL(String(url)).pathname);
      return new Response(JSON.stringify({ data: { id: "sched-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any;

    try {
      await orbit.schedules.create({ workflowId: "wf-1", cronExpression: "0 0 * * *" });
      await orbit.schedules.get("sched-1");
      await orbit.schedules.update("sched-1", { timezone: "America/New_York" });
      await orbit.schedules.delete("sched-1");

      expect(requestedPaths).toContain("/v1/schedules");
      expect(requestedPaths).toContain("/v1/schedules/sched-1");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
