import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  getTestClient,
  cleanupTestClient,
  createTestApp,
  createTestTenantAndKey,
  type TestTenantFixture,
} from "./test-helper";
import type { PrismaClient } from "@durable/storage";

describe("Workflow & Version Management", () => {
  let client: PrismaClient;
  let app: ReturnType<typeof createTestApp>;
  let tenantA: TestTenantFixture;
  let tenantB: TestTenantFixture;

  beforeAll(async () => {
    client = getTestClient();
    app = createTestApp(client);
    tenantA = await createTestTenantAndKey(client, "tenant-a");
    tenantB = await createTestTenantAndKey(client, "tenant-b");
  });

  afterAll(async () => {
    await cleanupTestClient(client);
  });

  let workflowId: string;
  const workflowKey = `order-processing-${Date.now()}`;

  test("POST /v1/workflows creates a new workflow", async () => {
    const res = await app.request("/v1/workflows", {
      method: "POST",
      headers: tenantA.headers,
      body: JSON.stringify({
        key: workflowKey,
        name: "Order Processing Workflow",
        metadata: { department: "logistics" },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBeTruthy();
    expect(body.data.key).toBe(workflowKey);
    expect(body.data.name).toBe("Order Processing Workflow");
    expect(body.data.metadata.department).toBe("logistics");

    workflowId = body.data.id;
  });

  test("POST /v1/workflows rejects duplicate workflow key for same tenant with 409 CONFLICT", async () => {
    const res = await app.request("/v1/workflows", {
      method: "POST",
      headers: tenantA.headers,
      body: JSON.stringify({
        key: workflowKey,
        name: "Duplicate Key Attempt",
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
  });

  test("POST /v1/workflows rejects invalid payload with 400 VALIDATION_ERROR", async () => {
    const res = await app.request("/v1/workflows", {
      method: "POST",
      headers: tenantA.headers,
      body: JSON.stringify({
        key: "", // empty key
        name: "", // empty name
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.length).toBeGreaterThan(0);
  });

  test("GET /v1/workflows lists workflows with pagination", async () => {
    const res = await app.request("/v1/workflows?limit=10&offset=0", {
      headers: tenantA.headers,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination.limit).toBe(10);
    expect(body.pagination.offset).toBe(0);
    expect(body.data.some((w: any) => w.id === workflowId)).toBe(true);
  });

  test("GET /v1/workflows/:workflowId retrieves workflow by ID", async () => {
    const res = await app.request(`/v1/workflows/${workflowId}`, {
      headers: tenantA.headers,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(workflowId);
    expect(body.data.name).toBe("Order Processing Workflow");
  });

  test("PATCH /v1/workflows/:workflowId updates workflow", async () => {
    const res = await app.request(`/v1/workflows/${workflowId}`, {
      method: "PATCH",
      headers: tenantA.headers,
      body: JSON.stringify({
        name: "Updated Order Processing",
        metadata: { department: "finance" },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("Updated Order Processing");
    expect(body.data.metadata.department).toBe("finance");
  });

  let versionId: string;

  test("POST /v1/workflows/:workflowId/versions registers a workflow version", async () => {
    const definition = {
      name: "order-processing",
      steps: [
        { id: "validate-payment", retries: 3 },
        { id: "ship-order", retries: 2 },
      ],
    };

    const res = await app.request(`/v1/workflows/${workflowId}/versions`, {
      method: "POST",
      headers: tenantA.headers,
      body: JSON.stringify({
        version: 1,
        definition,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBeTruthy();
    expect(body.data.version).toBe(1);
    expect(body.data.checksum).toBeTruthy();
    expect(body.data.isActive).toBe(false);

    versionId = body.data.id;
  });

  test("POST /v1/workflows/:workflowId/versions rejects duplicate version number with 409", async () => {
    const res = await app.request(`/v1/workflows/${workflowId}/versions`, {
      method: "POST",
      headers: tenantA.headers,
      body: JSON.stringify({
        version: 1,
        definition: {},
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
  });

  test("POST /v1/workflows/:workflowId/versions/:versionId/activate activates version", async () => {
    const res = await app.request(
      `/v1/workflows/${workflowId}/versions/${versionId}/activate`,
      {
        method: "POST",
        headers: tenantA.headers,
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(versionId);
    expect(body.data.isActive).toBe(true);
    expect(body.data.activatedAt).toBeTruthy();
  });

  test("GET /v1/workflows/:workflowId/versions lists versions", async () => {
    const res = await app.request(`/v1/workflows/${workflowId}/versions`, {
      headers: tenantA.headers,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(versionId);
    expect(body.data[0].isActive).toBe(true);
  });

  // ─── Tenant Isolation ─────────────────────────────────────────────

  test("tenant isolation: Tenant B cannot access Tenant A's workflow", async () => {
    const res = await app.request(`/v1/workflows/${workflowId}`, {
      headers: tenantB.headers,
    });

    expect(res.status).toBe(404);
  });

  test("tenant isolation: Tenant B cannot list or activate Tenant A's version", async () => {
    const listRes = await app.request(
      `/v1/workflows/${workflowId}/versions`,
      { headers: tenantB.headers }
    );
    expect(listRes.status).toBe(404);

    const activateRes = await app.request(
      `/v1/workflows/${workflowId}/versions/${versionId}/activate`,
      {
        method: "POST",
        headers: tenantB.headers,
      }
    );
    expect(activateRes.status).toBe(404);
  });

  test("DELETE /v1/workflows/:workflowId deletes workflow", async () => {
    const res = await app.request(`/v1/workflows/${workflowId}`, {
      method: "DELETE",
      headers: tenantA.headers,
    });

    expect(res.status).toBe(204);

    // Subsequent retrieval fails
    const check = await app.request(`/v1/workflows/${workflowId}`, {
      headers: tenantA.headers,
    });
    expect(check.status).toBe(404);
  });
});
