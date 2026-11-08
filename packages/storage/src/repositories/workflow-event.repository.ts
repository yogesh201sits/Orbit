import type { PrismaClient } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";
import type {
  TransactionClient,
  IWorkflowEventRepository,
  CreateWorkflowEventInput,
  WorkflowEventRecord,
} from "./interfaces";
import { NotFoundError } from "../errors/storage-errors";

export class PrismaWorkflowEventRepository implements IWorkflowEventRepository {
  constructor(private readonly client: PrismaClient) {}

  private db(tx?: TransactionClient) {
    return tx ?? this.client;
  }

  async create(
    input: CreateWorkflowEventInput,
    tx?: TransactionClient
  ): Promise<WorkflowEventRecord> {
    if (!tx) {
      return this.client.$transaction((transaction) =>
        this.create(input, transaction)
      );
    }

    const runs = await tx.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM workflow_runs
      WHERE id = ${input.runId}::uuid
      FOR UPDATE
    `;
    if (runs.length === 0) {
      throw new NotFoundError("WorkflowRun", input.runId);
    }

    const latest = await tx.workflowEvent.aggregate({
      where: { runId: input.runId },
      _max: { sequence: true },
    });
    return tx.workflowEvent.create({
      data: {
        runId: input.runId,
        type: input.type,
        payload: input.payload ?? Prisma.JsonNull,
        sequence: (latest._max.sequence ?? 0) + 1,
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
