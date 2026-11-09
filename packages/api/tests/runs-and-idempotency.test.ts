import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  getTestClient,
  cleanupTestClient,
  createTestApp,
  createTestTenantAndKey,
  type TestTenantFixture,
} from "./test-helper";
import type { PrismaClient } from "@durable/storage";

describe("Workflow Runs & Idempotency", () => {
  let client: PrismaClient;
  let app: ReturnType<typeof createTestApp>;
  let tenantA: TestTenantFixture;
  let tenantB: TestTenantFixture;
  let workflowId: string;
  let versionId: string;

  beforeAll(async () => {
    client = getTestClient();
    app = createTestApp(client);
    tenantA = await createTestTenantAndKey(client, "runs-a");
    tenantB = await createTestTenantAndKey(client, "runs-b");

    // Create workflow and activated version in Tenant A
    const wfRes = await app.request("/v1/workflows", {
      method: "POST",
      headers: tenantA.headers,
      body: JSON.stringify({
        key: `run-wf-${Date.now()}`,
        name: "Run Test Workflow",
      }),
    });
    const wfData = await wfRes.json();
    workflowId = wfData.data.id;

    const verRes = await app.request(`/v1/workflows/${workflowId}/versions`, {
      method: "POST",
      headers: tenantA.headers,
      body: JSON.stringify({
        version: 1,
        definition: { name: "run-test", steps: [{ id: "step-1" }] },
        isActive: true,
      }),
    });
    const verData = await verRes.json();
    versionId = verData.data.id;
  });

  afterAll(async () => {
    await cleanupTestClient(client);
  });

  test("POST /v1/workflows/:workflowId/runs creates run and enqueues job transactionally", async () => {
    const res = await app.request(`/v1/workflows/${workflowId}/runs`, {
      method: "POST",
      headers: tenantA.headers,
      body: JSON.stringify({
        input: { amount: 100, currency: "USD" },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBeTruthy();
    expect(body.data.workflowId).toBe(workflowId);
    expect(body.data.versionId).toBe(versionId);
    expect(body.data.status).toBe("PENDING");
    expect(body.data.input.amount).toBe(100);
    expect(body.isIdempotentReplay).toBe(false);

    // Verify job was created in PostgreSQL
    const job = await client.job.findFirst({
      where: { tenantId: tenantA.tenantId },
      orderBy: { createdAt: "desc" },
    });
    expect(job).not.toBeNull();
    expect(job!.type).toBe("workflow.dispatch");
    const payload = job!.payload as any;
    expect(payload.runId).toBe(body.data.id);
  });

  test("idempotency: subsequent request with same Idempotency-Key returns original run", async () => {
    const idempotencyKey = `idem-key-${Date.now()}`;

    // Request 1: creates the run
    const res1 = await app.request(`/v1/workflows/${workflowId}/runs`, {
      method: "POST",
      headers: {
        ...tenantA.headers,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ input: { orderId: 42 } }),
    });

    expect(res1.status).toBe(201);
    const body1 = await res1.json();
    const originalRunId = body1.data.id;
    expect(body1.isIdempotentReplay).toBe(false);

    // Request 2: replays with same key
    const res2 = await app.request(`/v1/workflows/${workflowId}/runs`, {
      method: "POST",
      headers: {
        ...tenantA.headers,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ input: { orderId: 42 } }),
    });

    expect(res2.status).toBe(200);
    expect(res2.headers.get("x-idempotent-replay")).toBe("true");
    const body2 = await res2.json();
    expect(body2.data.id).toBe(originalRunId);
    expect(body2.isIdempotentReplay).toBe(true);
  });

  test("concurrent run creation with same Idempotency-Key creates exactly one run", async () => {
    const sharedIdempotencyKey = `concurrent-key-${Date.now()}`;

    // Launch 5 concurrent requests with identical Idempotency-Key
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        app.request(`/v1/workflows/${workflowId}/runs`, {
          method: "POST",
          headers: {
            ...tenantA.headers,
            "idempotency-key": sharedIdempotencyKey,
          },
          body: JSON.stringify({ input: { race: true } }),
        })
      )
    );

    const jsonBodies = await Promise.all(responses.map((r) => r.json()));
    const createdRunIds = new Set(jsonBodies.map((b) => b.data.id));

    // Exactly ONE run ID created across all 5 requests!
    expect(createdRunIds.size).toBe(1);

    // Verify all returned success (either 201 or 200)
    for (const res of responses) {
      expect([200, 201]).toContain(res.status);
    }
  });

  let inspectedRunId: string;

  test("GET /v1/runs lists runs with pagination and filters", async () => {
    const createRes = await app.request(`/v1/workflows/${workflowId}/runs`, {
      method: "POST",
      headers: tenantA.headers,
      body: JSON.stringify({ input: { test: true } }),
    });
    const runData = (await createRes.json()).data;
    inspectedRunId = runData.id;

    // List runs
    const listRes = await app.request(
      `/v1/runs?workflowId=${workflowId}&status=PENDING&limit=10&offset=0`,
      { headers: tenantA.headers }
    );

    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data.length).toBeGreaterThan(0);
    expect(listBody.pagination.limit).toBe(10);
    expect(listBody.data.some((r: any) => r.id === inspectedRunId)).toBe(true);
  });

  test("GET /v1/runs/:runId retrieves single run details", async () => {
    const res = await app.request(`/v1/runs/${inspectedRunId}`, {
      headers: tenantA.headers,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(inspectedRunId);
    expect(body.data.workflowId).toBe(workflowId);
  });

  test("POST /v1/runs/:runId/cancel cancels run", async () => {
    const res = await app.request(`/v1/runs/${inspectedRunId}/cancel`, {
      method: "POST",
      headers: tenantA.headers,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("CANCELLED");
    expect(body.data.completedAt).toBeTruthy();
  });

  test("POST /v1/runs/:runId/retry retries failed run and enqueues job", async () => {
    // 1. Mark run as FAILED in DB to simulate failure
    await client.workflowRun.update({
      where: { id: inspectedRunId },
      data: { status: "FAILED", error: { message: "Simulated step error" } },
    });

    // 2. Call retry
    const res = await app.request(`/v1/runs/${inspectedRunId}/retry`, {
      method: "POST",
      headers: tenantA.headers,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("PENDING");

    // 3. Verify a retry job was enqueued
    const jobs = await client.job.findMany({
      where: { tenantId: tenantA.tenantId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(jobs.length).toBe(1);
    expect((jobs[0]!.payload as any).runId).toBe(inspectedRunId);
  });

  test("GET /v1/runs/:runId/steps and /events returns execution history", async () => {
    // Create dummy step and event using repositories
    const { PrismaWorkflowStepRepository, PrismaWorkflowEventRepository } = await import("@durable/storage");
    const stepRepo = new PrismaWorkflowStepRepository(client);
    const eventRepo = new PrismaWorkflowEventRepository(client);

    await stepRepo.create({
      runId: inspectedRunId,
      stepKey: "step-1",
      type: "action",
    });

    await eventRepo.create({
      runId: inspectedRunId,
      type: "step.completed",
      payload: { stepKey: "step-1" },
    });

    // Inspect steps
    const stepsRes = await app.request(`/v1/runs/${inspectedRunId}/steps`, {
      headers: tenantA.headers,
    });
    expect(stepsRes.status).toBe(200);
    const stepsBody = await stepsRes.json();
    expect(stepsBody.data.length).toBe(1);
    expect(stepsBody.data[0].stepKey).toBe("step-1");

    // Inspect events
    const eventsRes = await app.request(`/v1/runs/${inspectedRunId}/events`, {
      headers: tenantA.headers,
    });
    expect(eventsRes.status).toBe(200);
    const eventsBody = await eventsRes.json();
    expect(eventsBody.data.length).toBeGreaterThan(0);
  });

  // ─── Tenant Isolation ─────────────────────────────────────────────

  test("tenant isolation: Tenant B cannot inspect or manipulate Tenant A's run", async () => {
    const getRes = await app.request(`/v1/runs/${inspectedRunId}`, {
      headers: tenantB.headers,
    });
    expect(getRes.status).toBe(404);

    const cancelRes = await app.request(`/v1/runs/${inspectedRunId}/cancel`, {
      method: "POST",
      headers: tenantB.headers,
    });
    expect(cancelRes.status).toBe(404);

    const retryRes = await app.request(`/v1/runs/${inspectedRunId}/retry`, {
      method: "POST",
      headers: tenantB.headers,
    });
    expect(retryRes.status).toBe(404);

    const stepsRes = await app.request(`/v1/runs/${inspectedRunId}/steps`, {
      headers: tenantB.headers,
    });
    expect(stepsRes.status).toBe(404);

    const eventsRes = await app.request(`/v1/runs/${inspectedRunId}/events`, {
      headers: tenantB.headers,
    });
    expect(eventsRes.status).toBe(404);
  });
});
