import type { PrismaClient } from "../generated/prisma/client";
import type {
  TransactionClient,
  IApiKeyRepository,
  CreateApiKeyInput,
  ApiKeyRecord,
} from "./interfaces";
import { NotFoundError } from "../errors/storage-errors";

export class PrismaApiKeyRepository implements IApiKeyRepository {
  constructor(private readonly client: PrismaClient) {}

  private db(tx?: TransactionClient) {
    return tx ?? this.client;
  }

  async create(
    input: CreateApiKeyInput,
    tx?: TransactionClient
  ): Promise<ApiKeyRecord> {
    return this.db(tx).apiKey.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        keyHash: input.keyHash,
        keyPrefix: input.keyPrefix,
        expiresAt: input.expiresAt ?? null,
      },
    });
  }

  async findById(
    tenantId: string,
    id: string,
    tx?: TransactionClient
  ): Promise<ApiKeyRecord | null> {
    return this.db(tx).apiKey.findFirst({
      where: { id, tenantId },
    });
  }

  async findByKeyHash(
    keyHash: string,
    tx?: TransactionClient
  ): Promise<ApiKeyRecord | null> {
    return this.db(tx).apiKey.findUnique({
      where: { keyHash },
    });
  }

  async revoke(
    tenantId: string,
    id: string,
    tx?: TransactionClient
  ): Promise<ApiKeyRecord> {
    const existing = await this.findById(tenantId, id, tx);
    if (!existing) {
      throw new NotFoundError("ApiKey", id);
    }

    return this.db(tx).apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async listByTenant(
    tenantId: string,
    tx?: TransactionClient
  ): Promise<readonly ApiKeyRecord[]> {
    return this.db(tx).apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async delete(
    tenantId: string,
    id: string,
    tx?: TransactionClient
  ): Promise<void> {
    const existing = await this.findById(tenantId, id, tx);
    if (!existing) {
      throw new NotFoundError("ApiKey", id);
    }

    await this.db(tx).apiKey.delete({
      where: { id },
    });
  }
}
