/**
 * Server-side authentication & tenant boundary.
 *
 * Prepared for future Clerk integration.
 * In production with Clerk, this module will resolve the session from Clerk's SDK
 * (e.g. auth().userId, auth().orgId) and map it to the active Orbit tenant.
 *
 * In local development, it resolves the tenant from server environment variables
 * (e.g. ORBIT_TENANT_ID, ORBIT_API_KEY) without exposing credentials to client bundles.
 */

export interface TenantContext {
  readonly tenantId: string;
  readonly tenantSlug: string;
  readonly tenantName: string;
  readonly environment: "development" | "staging" | "production";
}

export interface AuthSession {
  readonly isAuthenticated: boolean;
  readonly userId: string | null;
  readonly tenant: TenantContext;
  readonly authProvider: "dev-boundary" | "clerk-future";
}

const DEFAULT_DEV_TENANT: TenantContext = {
  tenantId: process.env.ORBIT_TENANT_ID || "00000000-0000-0000-0000-000000000001",
  tenantSlug: "acme-corp",
  tenantName: "Acme Corp (Primary)",
  environment: (process.env.ORBIT_ENVIRONMENT as TenantContext["environment"]) || "development",
};

export async function getServerSession(): Promise<AuthSession> {
  // Replaceable boundary: when Clerk is configured, call `await auth()` from `@clerk/nextjs` here.
  return {
    isAuthenticated: true,
    userId: "dev-user-01",
    tenant: DEFAULT_DEV_TENANT,
    authProvider: "dev-boundary",
  };
}

export async function getTenantId(): Promise<string> {
  const session = await getServerSession();
  return session.tenant.tenantId;
}

export function getOrbitApiUrl(): string {
  return process.env.ORBIT_API_URL || "http://localhost:3001";
}

export function getOrbitApiKey(): string | undefined {
  return process.env.ORBIT_API_KEY;
}
