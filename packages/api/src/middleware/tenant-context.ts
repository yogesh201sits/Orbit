import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { UnauthorizedError } from "../errors/api-errors";
import type { AppEnv } from "../types";

/**
 * Extracts and asserts the authenticated tenant ID from the Hono context.
 * Never trust or read tenant IDs from client request bodies or params.
 */
export function getTenantId(c: Context<AppEnv>): string {
  const tenantId = c.get("tenantId");
  if (!tenantId) {
    throw new UnauthorizedError("Tenant context missing or unauthenticated");
  }
  return tenantId;
}

/**
 * Middleware ensuring that every request passing through has a resolved tenant identity.
 */
export const requireTenantContext = createMiddleware<AppEnv>(async (c, next) => {
  const tenantId = c.get("tenantId");
  if (!tenantId) {
    throw new UnauthorizedError("Authentication required for tenant-scoped operations");
  }
  await next();
});
