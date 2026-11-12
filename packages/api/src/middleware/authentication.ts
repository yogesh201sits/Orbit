import { createMiddleware } from "hono/factory";
import { createClerkClient } from "@clerk/backend";
import { UnauthorizedError } from "../errors/api-errors";
import type { AppEnv } from "../types";

export interface AuthMiddlewareOptions {
  /** Optional custom validator */
  readonly required?: boolean;
}

let cachedClerkClient: ReturnType<typeof createClerkClient> | null = null;

function getClerkClient(): ReturnType<typeof createClerkClient> | null {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (secretKey && publishableKey) {
    if (!cachedClerkClient) {
      cachedClerkClient = createClerkClient({ secretKey, publishableKey });
    }
    return cachedClerkClient;
  }
  return null;
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

    // Path A: Orbit API Key (orb_live_*)
    if (rawKey && rawKey.startsWith("orb_live_")) {
      const authService = c.get("services").auth;
      const apiKeyRecord = await authService.validateApiKey(rawKey);

      if (!apiKeyRecord) {
        throw new UnauthorizedError("Invalid, revoked, or expired API key");
      }

      c.set("tenantId", apiKeyRecord.tenantId);
      c.set("apiKey", apiKeyRecord);
      return await next();
    }

    // Path B: Clerk Session / JWT Token authentication
    const clerk = getClerkClient();
    if (clerk) {
      try {
        const reqState = await clerk.authenticateRequest(c.req.raw);
        if (reqState.isSignedIn) {
          const auth = reqState.toAuth();
          const authService = c.get("services").auth;
          const tenantId = await authService.resolveTenantForClerk(auth);
          c.set("tenantId", tenantId);
          c.set("clerkAuth", auth);
          return await next();
        }
      } catch {
        // Fall through to API key check or unauthorized
      }
    }

    // Path C: Non-prefixed raw key lookup via AuthService
    if (rawKey) {
      const authService = c.get("services").auth;
      const apiKeyRecord = await authService.validateApiKey(rawKey);
      if (apiKeyRecord) {
        c.set("tenantId", apiKeyRecord.tenantId);
        c.set("apiKey", apiKeyRecord);
        return await next();
      }
    }

    if (!rawKey) {
      if (options.required) {
        throw new UnauthorizedError("Missing API key credentials or Clerk authentication token");
      }
      return await next();
    }

    throw new UnauthorizedError("Invalid or expired authentication credentials");
  });
}
