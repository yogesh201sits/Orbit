import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type {
  TransactionClient,
  IOutboxRepository,
  CreateOutboxEventInput,
  OutboxEventRecord,
} from "./interfaces";

export class PrismaOutboxRepository implements IOutboxRepository {
  constructor(private readonly client: PrismaClient) {}

  private db(tx?: TransactionClient) {
    return tx ?? this.client;
  }

  async create(
    input: CreateOutboxEventInput,
    tx?: TransactionClient
  ): Promise<OutboxEventRecord> {
    return this.db(tx).outboxEvent.create({
      data: {
        tenantId: input.tenantId,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload as Prisma.InputJsonValue,
        published: false,
      },
    });
  }

  async fetchUnpublished(
    batchSize: number,
    tx?: TransactionClient
  ): Promise<readonly OutboxEventRecord[]> {
    return this.db(tx).outboxEvent.findMany({
      where: { published: false },
      orderBy: { createdAt: "asc" },
      take: batchSize,
    });
  }

  async markPublished(
    ids: string[],
    tx?: TransactionClient
  ): Promise<void> {
    await this.db(tx).outboxEvent.updateMany({
      where: { id: { in: ids } },
      data: { published: true, publishedAt: new Date() },
    });
  }
}
