import type { PrismaClient } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";
import type {
  TransactionClient,
  ITenantRepository,
  CreateTenantInput,
  UpdateTenantInput,
  TenantRecord,
  PaginationParams,
  PaginatedResult,
} from "./interfaces";
import { NotFoundError, ConflictError } from "../errors/storage-errors";

export class PrismaTenantRepository implements ITenantRepository {
  constructor(private readonly client: PrismaClient) {}

  private db(tx?: TransactionClient) {
    return tx ?? this.client;
  }

  async create(
    input: CreateTenantInput,
    tx?: TransactionClient
  ): Promise<TenantRecord> {
    try {
      return await this.db(tx).tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          metadata: input.metadata ?? Prisma.JsonNull,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictError(
          `Tenant with slug "${input.slug}" already exists`,
          "uq_tenant_slug"
        );
      }
      throw e;
    }
  }

  async findById(
    id: string,
    tx?: TransactionClient
  ): Promise<TenantRecord | null> {
    return this.db(tx).tenant.findFirst({ where: { id, deletedAt: null } });
  }

  async findBySlug(
    slug: string,
    tx?: TransactionClient
  ): Promise<TenantRecord | null> {
    return this.db(tx).tenant.findFirst({ where: { slug, deletedAt: null } });
  }

  async update(
    id: string,
    input: UpdateTenantInput,
    tx?: TransactionClient
  ): Promise<TenantRecord> {
    const result = await this.db(tx).tenant.updateMany({
      where: { id, deletedAt: null },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.metadata !== undefined && { metadata: input.metadata ?? Prisma.JsonNull }),
      },
    });
    if (result.count === 0) {
      throw new NotFoundError("Tenant", id);
    }
    return this.db(tx).tenant.findFirstOrThrow({
      where: { id, deletedAt: null },
    });
  }

  async delete(id: string, tx?: TransactionClient): Promise<void> {
    const result = await this.db(tx).tenant.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundError("Tenant", id);
    }
  }

  async list(
    pagination: PaginationParams,
    tx?: TransactionClient
  ): Promise<PaginatedResult<TenantRecord>> {
    const [data, total] = await Promise.all([
      this.db(tx).tenant.findMany({
        where: { deletedAt: null },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
      }),
      this.db(tx).tenant.count({ where: { deletedAt: null } }),
    ]);
    return { data, total, limit: pagination.limit, offset: pagination.offset };
  }
}
