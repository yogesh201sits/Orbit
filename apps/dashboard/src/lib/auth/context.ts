import { auth } from "@clerk/nextjs/server";

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
  readonly authProvider: "dev-boundary" | "clerk";
}

const DEFAULT_DEV_TENANT: TenantContext = {
  tenantId: process.env.ORBIT_TENANT_ID || "00000000-0000-0000-0000-000000000001",
  tenantSlug: "acme-corp",
  tenantName: "Acme Corp (Primary)",
  environment: (process.env.ORBIT_ENVIRONMENT as TenantContext["environment"]) || "development",
};

export async function getServerSession(): Promise<AuthSession> {
  try {
    const { userId, orgId, orgSlug } = await auth();
    if (userId) {
      return {
        isAuthenticated: true,
        userId,
        tenant: {
          tenantId: orgId || process.env.ORBIT_TENANT_ID || DEFAULT_DEV_TENANT.tenantId,
          tenantSlug: orgSlug || DEFAULT_DEV_TENANT.tenantSlug,
          tenantName: orgSlug ? orgSlug.toUpperCase() : DEFAULT_DEV_TENANT.tenantName,
          environment: DEFAULT_DEV_TENANT.environment,
        },
        authProvider: "clerk",
      };
    }
  } catch {
    // Fallback for static build phases or environments without request context
  }

  return {
    isAuthenticated: false,
    userId: null,
    tenant: DEFAULT_DEV_TENANT,
    authProvider: "clerk",
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
