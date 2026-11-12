import { createHash, randomBytes } from "node:crypto";
import type { IApiKeyRepository, ApiKeyRecord, ITenantRepository } from "@durable/storage";
import { createClerkClient } from "@clerk/backend";

export interface CreateApiKeyResult {
  readonly apiKey: ApiKeyRecord;
  readonly plainTextKey: string;
  readonly clerkApiKey?: any;
}

export class AuthService {
  private clerkClientInstance: ReturnType<typeof createClerkClient> | null = null;

  constructor(
    private readonly apiKeyRepo: IApiKeyRepository,
    private readonly tenantRepo?: ITenantRepository
  ) {}

  private getClerkClient(): ReturnType<typeof createClerkClient> | null {
    if (!this.clerkClientInstance) {
      const secretKey = process.env.CLERK_SECRET_KEY;
      const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      if (secretKey && publishableKey) {
        this.clerkClientInstance = createClerkClient({ secretKey, publishableKey });
      }
    }
    return this.clerkClientInstance;
  }

  /**
   * Hashes a raw API key using SHA-256 for secure constant-time storage/lookup.
   */
  hashKey(rawKey: string): string {
    return createHash("sha256").update(rawKey).digest("hex");
  }

  /**
   * Converts a non-UUID Clerk identifier (user_... or org_...) to a deterministic UUID v4 string.
   */
  clerkIdToUuid(clerkId: string): string {
    const h = createHash("sha256").update(clerkId).digest("hex");
    return [
      h.slice(0, 8),
      h.slice(8, 12),
      "4" + h.slice(13, 16),
      "a" + h.slice(17, 20),
      h.slice(20, 32),
    ].join("-");
  }

  /**
   * Resolves or provisions a tenant for an authenticated Clerk session.
   * Guarantees a valid PostgreSQL UUID and ensures the record exists in the database.
   */
  async resolveTenantForClerk(clerkAuth: {
    userId: string;
    orgId?: string | null | undefined;
    orgSlug?: string | null | undefined;
  }): Promise<string> {
    const rawId = clerkAuth.orgId || clerkAuth.userId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId);
    const tenantId = isUuid ? rawId : this.clerkIdToUuid(rawId);

    if (this.tenantRepo) {
      try {
        const existing = await this.tenantRepo.findById(tenantId);
        if (!existing) {
          const rawSlug = (clerkAuth.orgSlug || clerkAuth.userId).toLowerCase().replace(/[^a-z0-9_-]/g, "");
          const slug = `${rawSlug.slice(0, 30)}-${tenantId.slice(0, 8)}`;
          await this.tenantRepo.create({
            id: tenantId,
            name: clerkAuth.orgSlug ? clerkAuth.orgSlug.toUpperCase() : `User ${clerkAuth.userId.slice(-6)}`,
            slug,
            metadata: { clerkId: rawId, userId: clerkAuth.userId, orgId: clerkAuth.orgId },
          });
        }
      } catch {
        // If already created concurrently, continue safely
      }
    }

    return tenantId;
  }

  /**
   * Ensures the default fallback tenant exists in the database.
   */
  async ensureDefaultTenant(): Promise<string> {
    const defaultId = "00000000-0000-0000-0000-000000000001";
    if (this.tenantRepo) {
      try {
        const existing = await this.tenantRepo.findById(defaultId);
        if (!existing) {
          await this.tenantRepo.create({
            id: defaultId,
            name: "Acme Corp (Primary)",
            slug: "acme-corp",
            metadata: { isDefault: true },
          });
        }
      } catch {
        // Ignore if exists
      }
    }
    return defaultId;
  }

  /**
   * Generates a new cryptographically secure API key for a tenant.
   * Format: orb_live_<hex(24)>
   * The plaintext key is returned ONLY once upon creation.
   * Also synchronizes with Clerk API keys when Clerk credentials are provided.
   */
  async createApiKey(
    tenantId: string,
    name: string,
    expiresAt?: Date | null
  ): Promise<CreateApiKeyResult> {
    const randomHex = randomBytes(24).toString("hex");
    const plainTextKey = `orb_live_${randomHex}`;
    const keyHash = this.hashKey(plainTextKey);
    const keyPrefix = plainTextKey.slice(0, 14); // e.g. "orb_live_12345"

    const apiKey = await this.apiKeyRepo.create({
      tenantId,
      name,
      keyHash,
      keyPrefix,
      expiresAt: expiresAt ?? null,
    });

    let clerkApiKey: any = undefined;
    const clerk = this.getClerkClient();
    if (clerk && (clerk as any).apiKeys) {
      try {
        clerkApiKey = await (clerk as any).apiKeys.create({
          name,
          subject: tenantId,
        });
      } catch (err) {
        // Clerk API keys synchronization is optional/fallback
      }
    }

    return { apiKey, plainTextKey, clerkApiKey };
  }

  /**
   * Validates a provided API key against the database or Clerk:
   * - Computes SHA-256 hash for Orbit keys
   * - Queries key record
   * - Checks revocation and expiration
   * - Fallback verification through Clerk API Key verification
   */
  async validateApiKey(rawKey: string): Promise<ApiKeyRecord | null> {
    if (!rawKey || typeof rawKey !== "string") {
      return null;
    }

    if (rawKey.startsWith("orb_live_")) {
      const keyHash = this.hashKey(rawKey);
      const record = await this.apiKeyRepo.findByKeyHash(keyHash);
      if (!record) {
        return null;
      }

      // Check if key is revoked
      if (record.revokedAt !== null) {
        return null;
      }

      // Check if key is expired
      if (record.expiresAt !== null && record.expiresAt.getTime() <= Date.now()) {
        return null;
      }

      return record;
    }

    // Check with Clerk API key verification if configured
    const clerk = this.getClerkClient();
    if (clerk && (clerk as any).apiKeys) {
      try {
        const verifyRes = await (clerk as any).apiKeys.verify(rawKey);
        if (verifyRes) {
          return {
            id: verifyRes.id || "clerk-key",
            tenantId: (verifyRes as any).ownerId || "00000000-0000-0000-0000-000000000001",
            name: verifyRes.name || "Clerk API Key",
            keyHash: this.hashKey(rawKey),
            keyPrefix: rawKey.slice(0, 10),
            revokedAt: null,
            expiresAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
      } catch {
        // Ignore Clerk verify error
      }
    }

    return null;
  }

  async revokeApiKey(tenantId: string, keyId: string): Promise<ApiKeyRecord> {
    const clerk = this.getClerkClient();
    if (clerk && (clerk as any).apiKeys) {
      try {
        await (clerk as any).apiKeys.revoke({ apiKeyId: keyId });
      } catch {
        // Ignore Clerk revoke error
      }
    }
    return this.apiKeyRepo.revoke(tenantId, keyId);
  }

  async listApiKeys(tenantId: string): Promise<readonly ApiKeyRecord[]> {
    return this.apiKeyRepo.listByTenant(tenantId);
  }
}
