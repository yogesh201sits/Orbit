import { Hono } from "hono";
import { getTenantId } from "../middleware/tenant-context";
import { CreateApiKeySchema } from "../schemas/auth.schema";
import { IdParamSchema } from "../schemas/common.schema";
import type { AppEnv } from "../types";

export function createAuthRoutes() {
  const router = new Hono<AppEnv>();

  // POST /v1/auth/api-keys
  router.post("/api-keys", async (c) => {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    const validatedDto = CreateApiKeySchema.parse(body);

    const result = await c.get("services").auth.createApiKey(
      tenantId,
      validatedDto.name,
      validatedDto.expiresAt
    );

    return c.json(
      {
        data: {
          id: result.apiKey.id,
          name: result.apiKey.name,
          keyPrefix: result.apiKey.keyPrefix,
          plainTextKey: result.plainTextKey,
          expiresAt: result.apiKey.expiresAt,
          createdAt: result.apiKey.createdAt,
          clerkApiKeyId: result.clerkApiKey?.id,
        },
      },
      201
    );
  });

  // GET /v1/auth/api-keys
  router.get("/api-keys", async (c) => {
    const tenantId = getTenantId(c);

    const keys = await c.get("services").auth.listApiKeys(tenantId);

    // Never return hashed keys or full tokens
    const sanitized = keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      revokedAt: k.revokedAt,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
    }));

    return c.json({ data: sanitized });
  });

  // DELETE /v1/auth/api-keys/:id
  router.delete("/api-keys/:id", async (c) => {
    const tenantId = getTenantId(c);
    const { id } = IdParamSchema.parse(c.req.param());

    const revoked = await c.get("services").auth.revokeApiKey(tenantId, id);

    return c.json({
      data: {
        id: revoked.id,
        name: revoked.name,
        revokedAt: revoked.revokedAt,
      },
    });
  });

  return router;
}
