import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type {
  TransactionClient,
  IWorkflowEventRepository,
  CreateWorkflowEventInput,
  WorkflowEventRecord,
} from "./interfaces";

export class PrismaWorkflowEventRepository implements IWorkflowEventRepository {
  constructor(private readonly client: PrismaClient) {}

  private db(tx?: TransactionClient) {
    return tx ?? this.client;
  }

  async create(
    input: CreateWorkflowEventInput,
    tx?: TransactionClient
  ): Promise<WorkflowEventRecord> {
    return this.db(tx).workflowEvent.create({
      data: {
        runId: input.runId,
        type: input.type,
        payload: input.payload ?? Prisma.JsonNull,
        sequence: input.sequence,
      },
    });
  }

  async listByRun(
    runId: string,
    tx?: TransactionClient
  ): Promise<readonly WorkflowEventRecord[]> {
    return this.db(tx).workflowEvent.findMany({
      where: { runId },
      orderBy: { sequence: "asc" },
    });
  }

  async getLatestSequence(
    runId: string,
    tx?: TransactionClient
  ): Promise<number> {
    const result = await this.db(tx).workflowEvent.aggregate({
      where: { runId },
      _max: { sequence: true },
    });
    return result._max.sequence ?? 0;
  }
}
