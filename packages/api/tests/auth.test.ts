import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  getTestClient,
  cleanupTestClient,
  createTestApp,
  createTestTenantAndKey,
  type TestTenantFixture,
} from "./test-helper";
import type { PrismaClient } from "@durable/storage";
import { AuthService } from "../src/services/auth.service";
import { PrismaApiKeyRepository } from "@durable/storage";

describe("Authentication & Tenant Context", () => {
  let client: PrismaClient;
  let app: ReturnType<typeof createTestApp>;
  let tenantFixture: TestTenantFixture;

  beforeAll(async () => {
    client = getTestClient();
    app = createTestApp(client);
    tenantFixture = await createTestTenantAndKey(client, "auth-test");
  });

  afterAll(async () => {
    await cleanupTestClient(client);
  });

  test("rejects request without credentials with 401 UNAUTHORIZED", async () => {
    const res = await app.request("/v1/workflows");
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toContain("Missing API key credentials");
  });

  test("rejects request with invalid key with 401 UNAUTHORIZED", async () => {
    const res = await app.request("/v1/workflows", {
      headers: {
        Authorization: "Bearer orb_live_invalid_key_1234567890",
      },
    });
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toContain("Invalid, revoked, or expired API key");
  });

  test("authenticates successfully with Authorization: Bearer <key>", async () => {
    const res = await app.request("/v1/workflows", {
      headers: {
        Authorization: `Bearer ${tenantFixture.plainTextKey}`,
      },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("authenticates successfully with X-API-Key header", async () => {
    const res = await app.request("/v1/workflows", {
      headers: {
        "x-api-key": tenantFixture.plainTextKey,
      },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("API key creation returns plaintext key once, stores hashed in database", async () => {
    const res = await app.request("/v1/auth/api-keys", {
      method: "POST",
      headers: tenantFixture.headers,
      body: JSON.stringify({
        name: "Secondary Integration Key",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("Secondary Integration Key");
    expect(body.data.plainTextKey).toStartWith("orb_live_");
    expect(body.data.keyPrefix).toBe(body.data.plainTextKey.slice(0, 14));

    // Verify key in database is hashed, not plaintext!
    const keyInDb = await client.apiKey.findUnique({
      where: { id: body.data.id },
    });
    expect(keyInDb).not.toBeNull();
    expect(keyInDb!.keyHash).not.toBe(body.data.plainTextKey);
    expect(keyInDb!.keyHash.length).toBe(64); // SHA-256 hex length
  });

  test("revoked API key immediately fails authentication with 401", async () => {
    // 1. Create a key
    const createRes = await app.request("/v1/auth/api-keys", {
      method: "POST",
      headers: tenantFixture.headers,
      body: JSON.stringify({ name: "Key to revoke" }),
    });
    const keyData = (await createRes.json()).data;

    // 2. Verify key works
    const check1 = await app.request("/v1/workflows", {
      headers: { Authorization: `Bearer ${keyData.plainTextKey}` },
    });
    expect(check1.status).toBe(200);

    // 3. Revoke key
    const revokeRes = await app.request(`/v1/auth/api-keys/${keyData.id}`, {
      method: "DELETE",
      headers: tenantFixture.headers,
    });
    expect(revokeRes.status).toBe(200);

    // 4. Verify revoked key is rejected
    const check2 = await app.request("/v1/workflows", {
      headers: { Authorization: `Bearer ${keyData.plainTextKey}` },
    });
    expect(check2.status).toBe(401);
  });

  test("expired API key is rejected with 401", async () => {
    const apiKeyRepo = new PrismaApiKeyRepository(client);
    const authService = new AuthService(apiKeyRepo);

    // Create key that expired 1 hour ago
    const pastDate = new Date(Date.now() - 3600000);
    const { plainTextKey } = await authService.createApiKey(
      tenantFixture.tenantId,
      "Expired Key",
      pastDate
    );

    const res = await app.request("/v1/workflows", {
      headers: { Authorization: `Bearer ${plainTextKey}` },
    });
    expect(res.status).toBe(401);
  });
});
