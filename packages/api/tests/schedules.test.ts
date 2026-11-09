import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  getTestClient,
  cleanupTestClient,
  createTestApp,
  createTestTenantAndKey,
  type TestTenantFixture,
} from "./test-helper";
import type { PrismaClient } from "@durable/storage";

describe("Workflow Schedules", () => {
  let client: PrismaClient;
  let app: ReturnType<typeof createTestApp>;
  let tenantA: TestTenantFixture;
  let tenantB: TestTenantFixture;
  let workflowId: string;

  beforeAll(async () => {
    client = getTestClient();
    app = createTestApp(client);
    tenantA = await createTestTenantAndKey(client, "sched-a");
    tenantB = await createTestTenantAndKey(client, "sched-b");

    const wfRes = await app.request("/v1/workflows", {
      method: "POST",
      headers: tenantA.headers,
      body: JSON.stringify({
        key: `sched-wf-${Date.now()}`,
        name: "Scheduled Workflow",
      }),
    });
    const wfData = await wfRes.json();
    workflowId = wfData.data.id;
  });

  afterAll(async () => {
    await cleanupTestClient(client);
  });

  let scheduleId: string;

  test("POST /v1/schedules creates a recurring cron schedule", async () => {
    const res = await app.request("/v1/schedules", {
      method: "POST",
      headers: tenantA.headers,
      body: JSON.stringify({
        workflowId,
        cronExpression: "0 9 * * 1-5", // 9 AM Mon-Fri
        timezone: "America/New_York",
        input: { job: "daily-report" },
        missedExecutionPolicy: "SKIP",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBeTruthy();
    expect(body.data.workflowId).toBe(workflowId);
    expect(body.data.cronExpression).toBe("0 9 * * 1-5");
    expect(body.data.timezone).toBe("America/New_York");
    expect(body.data.status).toBe("ACTIVE");
    expect(body.data.nextRunAt).toBeTruthy();

    scheduleId = body.data.id;
  });

  test("POST /v1/schedules rejects invalid cron expression with 400", async () => {
    const res = await app.request("/v1/schedules", {
      method: "POST",
      headers: tenantA.headers,
      body: JSON.stringify({
        workflowId,
        cronExpression: "invalid-cron-string",
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.message).toContain("Invalid cron expression");
  });

  test("POST /v1/schedules creates a delayed one-time schedule", async () => {
    const res = await app.request("/v1/schedules", {
      method: "POST",
      headers: tenantA.headers,
      body: JSON.stringify({
        workflowId,
        delayMs: 60000, // 1 minute in future
        input: { delayed: true },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBeTruthy();
    expect(body.data.cronExpression).toBeNull();
    const nextRun = new Date(body.data.nextRunAt).getTime();
    expect(nextRun).toBeGreaterThan(Date.now());
  });

  test("GET /v1/schedules lists schedules with pagination", async () => {
    const res = await app.request("/v1/schedules?limit=10&offset=0", {
      headers: tenantA.headers,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(body.pagination.limit).toBe(10);
    expect(body.data.some((s: any) => s.id === scheduleId)).toBe(true);
  });

  test("GET /v1/schedules/:scheduleId retrieves single schedule", async () => {
    const res = await app.request(`/v1/schedules/${scheduleId}`, {
      headers: tenantA.headers,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(scheduleId);
    expect(body.data.cronExpression).toBe("0 9 * * 1-5");
  });

  test("PATCH /v1/schedules/:scheduleId updates schedule", async () => {
    const res = await app.request(`/v1/schedules/${scheduleId}`, {
      method: "PATCH",
      headers: tenantA.headers,
      body: JSON.stringify({
        cronExpression: "0 12 * * *", // Noon daily
        status: "PAUSED",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.cronExpression).toBe("0 12 * * *");
    expect(body.data.status).toBe("PAUSED");
  });

  test("DELETE /v1/schedules/:scheduleId cancels schedule", async () => {
    const res = await app.request(`/v1/schedules/${scheduleId}`, {
      method: "DELETE",
      headers: tenantA.headers,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("CANCELLED");
  });

  // ─── Tenant Isolation ─────────────────────────────────────────────

  test("tenant isolation: Tenant B cannot access or modify Tenant A's schedule", async () => {
    const getRes = await app.request(`/v1/schedules/${scheduleId}`, {
      headers: tenantB.headers,
    });
    expect(getRes.status).toBe(404);

    const patchRes = await app.request(`/v1/schedules/${scheduleId}`, {
      method: "PATCH",
      headers: tenantB.headers,
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    expect(patchRes.status).toBe(404);

    const deleteRes = await app.request(`/v1/schedules/${scheduleId}`, {
      method: "DELETE",
      headers: tenantB.headers,
    });
    expect(deleteRes.status).toBe(404);
  });
});
