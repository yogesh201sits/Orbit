import type { PrismaClient } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";
import type {
  TransactionClient,
  IWorkerRepository,
  CreateWorkerInput,
  WorkerRecord,
} from "./interfaces";
import { NotFoundError } from "../errors/storage-errors";

export class PrismaWorkerRepository implements IWorkerRepository {
  constructor(private readonly client: PrismaClient) {}

  private db(tx?: TransactionClient) {
    return tx ?? this.client;
  }

  async create(
    input: CreateWorkerInput,
    tx?: TransactionClient
  ): Promise<WorkerRecord> {
    return this.db(tx).worker.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        queues: input.queues,
        status: "ACTIVE",
        lastHeartbeat: new Date(),
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  }

  async findById(
    tenantId: string,
    id: string,
    tx?: TransactionClient
  ): Promise<WorkerRecord | null> {
    return this.db(tx).worker.findFirst({
      where: { id, tenantId },
    });
  }

  async heartbeat(
    tenantId: string,
    id: string,
    tx?: TransactionClient
  ): Promise<WorkerRecord> {
    const existing = await this.db(tx).worker.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundError("Worker", id);
    }
    return this.db(tx).worker.update({
      where: { id },
      data: { lastHeartbeat: new Date(), status: "ACTIVE" },
    });
  }

  async deactivate(
    tenantId: string,
    id: string,
    tx?: TransactionClient
  ): Promise<WorkerRecord> {
    const existing = await this.db(tx).worker.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundError("Worker", id);
    }
    return this.db(tx).worker.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
  }

  async listActive(
    tenantId: string,
    tx?: TransactionClient
  ): Promise<readonly WorkerRecord[]> {
    return this.db(tx).worker.findMany({
      where: { tenantId, status: "ACTIVE" },
      orderBy: { lastHeartbeat: "desc" },
    });
  }
}
