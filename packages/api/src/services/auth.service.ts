import { createHash, randomBytes } from "node:crypto";
import type { IApiKeyRepository, ApiKeyRecord } from "@durable/storage";

export interface CreateApiKeyResult {
  readonly apiKey: ApiKeyRecord;
  readonly plainTextKey: string;
}

export class AuthService {
  constructor(private readonly apiKeyRepo: IApiKeyRepository) {}

  /**
   * Hashes a raw API key using SHA-256 for secure constant-time storage/lookup.
   */
  hashKey(rawKey: string): string {
    return createHash("sha256").update(rawKey).digest("hex");
  }

  /**
   * Generates a new cryptographically secure API key for a tenant.
   * Format: orb_live_<hex(24)>
   * The plaintext key is returned ONLY once upon creation.
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

    return { apiKey, plainTextKey };
  }

  /**
   * Validates a provided API key against the database:
   * - Computes SHA-256 hash
   * - Queries key record
   * - Checks revocation and expiration
   */
  async validateApiKey(rawKey: string): Promise<ApiKeyRecord | null> {
    if (!rawKey || typeof rawKey !== "string" || !rawKey.startsWith("orb_live_")) {
      return null;
    }

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

  async revokeApiKey(tenantId: string, keyId: string): Promise<ApiKeyRecord> {
    return this.apiKeyRepo.revoke(tenantId, keyId);
  }

  async listApiKeys(tenantId: string): Promise<readonly ApiKeyRecord[]> {
    return this.apiKeyRepo.listByTenant(tenantId);
  }
}
