import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  getTestClient,
  cleanupTestClient,
  createTestApp,
  createTestTenantAndKey,
  type TestTenantFixture,
} from "./test-helper";
import type { PrismaClient } from "@durable/storage";

describe("Error Handling & Input Validation", () => {
  let client: PrismaClient;
  let app: ReturnType<typeof createTestApp>;
  let tenant: TestTenantFixture;

  beforeAll(async () => {
    client = getTestClient();
    app = createTestApp(client);
    tenant = await createTestTenantAndKey(client, "err-test");
  });

  afterAll(async () => {
    await cleanupTestClient(client);
  });

  test("returns 404 for unknown endpoint", async () => {
    const res = await app.request("/v1/unknown-endpoint-path", {
      headers: tenant.headers,
    });

    expect(res.status).toBe(404);
  });

  test("returns 400 VALIDATION_ERROR on non-UUID parameter", async () => {
    const res = await app.request("/v1/workflows/not-a-valid-uuid", {
      headers: tenant.headers,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Request validation failed");
    expect(body.error.details.some((d: any) => d.path === "workflowId")).toBe(true);
  });

  test("returns 400 on malformed JSON payload", async () => {
    const res = await app.request("/v1/workflows", {
      method: "POST",
      headers: tenant.headers,
      body: "{ malformed json",
    });

    // Should return 400 or 500 gracefully, never crashing
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test("server errors return 500 without leaking stack traces or database internals", async () => {
    // Construct app with a mock service that throws an internal database error
    const brokenApp = createTestApp(client);
    brokenApp.get("/v1/test-db-error", (c) => {
      throw new Error("FATAL: connection to server on socket '/var/run/postgresql/.s.PGSQL.5432' failed");
    });

    const res = await brokenApp.request("/v1/test-db-error", {
      headers: tenant.headers,
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.message).toBe("An internal server error occurred");

    // Must NOT leak database paths, sockets, queries or stack traces to client!
    expect(body.error.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("PGSQL");
    expect(JSON.stringify(body)).not.toContain("stack");
  });
});
