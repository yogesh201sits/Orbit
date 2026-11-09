import { createMiddleware } from "hono/factory";
import { UnauthorizedError } from "../errors/api-errors";
import type { AppEnv } from "../types";

export interface AuthMiddlewareOptions {
  /** Optional custom validator */
  readonly required?: boolean;
}

export function authenticationMiddleware(options: AuthMiddlewareOptions = { required: true }) {
  return createMiddleware<AppEnv>(async (c, next) => {
    let rawKey: string | null = null;

    // 1. Check Authorization: Bearer <key>
    const authHeader = c.req.header("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      rawKey = authHeader.slice(7).trim();
    }

    // 2. Fallback to X-API-Key header
    if (!rawKey) {
      const apiKeyHeader = c.req.header("x-api-key");
      if (apiKeyHeader) {
        rawKey = apiKeyHeader.trim();
      }
    }

    if (!rawKey) {
      if (options.required) {
        throw new UnauthorizedError("Missing API key credentials");
      }
      return await next();
    }

    const authService = c.get("services").auth;
    const apiKeyRecord = await authService.validateApiKey(rawKey);

    if (!apiKeyRecord) {
      throw new UnauthorizedError("Invalid, revoked, or expired API key");
    }

    // Bind authenticated tenant identity to context
    c.set("tenantId", apiKeyRecord.tenantId);
    c.set("apiKey", apiKeyRecord);

    await next();
  });
}
