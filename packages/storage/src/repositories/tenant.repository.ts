import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
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
    return this.db(tx).tenant.findUnique({ where: { id } });
  }

  async findBySlug(
    slug: string,
    tx?: TransactionClient
  ): Promise<TenantRecord | null> {
    return this.db(tx).tenant.findUnique({ where: { slug } });
  }

  async update(
    id: string,
    input: UpdateTenantInput,
    tx?: TransactionClient
  ): Promise<TenantRecord> {
    try {
      return await this.db(tx).tenant.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.metadata !== undefined && { metadata: input.metadata ?? Prisma.JsonNull }),
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2025"
      ) {
        throw new NotFoundError("Tenant", id);
      }
      throw e;
    }
  }

  async delete(id: string, tx?: TransactionClient): Promise<void> {
    try {
      await this.db(tx).tenant.delete({ where: { id } });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2025"
      ) {
        throw new NotFoundError("Tenant", id);
      }
      throw e;
    }
  }

  async list(
    pagination: PaginationParams,
    tx?: TransactionClient
  ): Promise<PaginatedResult<TenantRecord>> {
    const [data, total] = await Promise.all([
      this.db(tx).tenant.findMany({
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
      }),
      this.db(tx).tenant.count(),
    ]);
    return { data, total, limit: pagination.limit, offset: pagination.offset };
  }
}
