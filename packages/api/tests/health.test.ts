import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  getTestClient,
  cleanupTestClient,
  createTestApp,
} from "./test-helper";
import type { PrismaClient } from "@durable/storage";

describe("Health & Platform Endpoints", () => {
  let client: PrismaClient;
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => {
    client = getTestClient();
    app = createTestApp(client);
  });

  afterAll(async () => {
    await cleanupTestClient(client);
  });

  test("GET /health returns 200 and liveness status", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");

    // Observability headers
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(res.headers.get("x-response-time")).toBeTruthy();
  });

  test("GET /ready returns 200 and database connectivity status", async () => {
    const res = await app.request("/ready");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ready");
    expect(body.database).toBe(true);
    expect(typeof body.timestamp).toBe("string");
  });

  test("propagates custom incoming x-request-id header", async () => {
    const customId = "custom-trace-uuid-12345";
    const res = await app.request("/health", {
      headers: {
        "x-request-id": customId,
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe(customId);
  });
});
