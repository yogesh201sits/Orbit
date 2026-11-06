import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type {
  TransactionClient,
  IWorkflowStepRepository,
  CreateWorkflowStepInput,
  UpdateWorkflowStepInput,
  WorkflowStepRecord,
} from "./interfaces";
import { NotFoundError, ConflictError } from "../errors/storage-errors";

export class PrismaWorkflowStepRepository implements IWorkflowStepRepository {
  constructor(private readonly client: PrismaClient) {}

  private db(tx?: TransactionClient) {
    return tx ?? this.client;
  }

  async create(
    input: CreateWorkflowStepInput,
    tx?: TransactionClient
  ): Promise<WorkflowStepRecord> {
    try {
      return await this.db(tx).workflowStep.create({
        data: {
          runId: input.runId,
          stepKey: input.stepKey,
          type: input.type,
          status: "pending",
          input: input.input ?? Prisma.JsonNull,
          attempt: 1,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictError(
          `Step with key "${input.stepKey}" already exists for run "${input.runId}"`,
          "uq_run_step_key"
        );
      }
      throw e;
    }
  }

  async findById(
    id: string,
    tx?: TransactionClient
  ): Promise<WorkflowStepRecord | null> {
    return this.db(tx).workflowStep.findUnique({ where: { id } });
  }

  async findByRunAndKey(
    runId: string,
    stepKey: string,
    tx?: TransactionClient
  ): Promise<WorkflowStepRecord | null> {
    return this.db(tx).workflowStep.findUnique({
      where: {
        uq_run_step_key: { runId, stepKey },
      },
    });
  }

  async update(
    id: string,
    input: UpdateWorkflowStepInput,
    tx?: TransactionClient
  ): Promise<WorkflowStepRecord> {
    try {
      return await this.db(tx).workflowStep.update({
        where: { id },
        data: {
          ...(input.status !== undefined && { status: input.status }),
          ...(input.output !== undefined && { output: input.output ?? Prisma.JsonNull }),
          ...(input.error !== undefined && { error: input.error ?? Prisma.JsonNull }),
          ...(input.attempt !== undefined && { attempt: input.attempt }),
          ...(input.startedAt !== undefined && { startedAt: input.startedAt }),
          ...(input.completedAt !== undefined && { completedAt: input.completedAt }),
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2025"
      ) {
        throw new NotFoundError("WorkflowStep", id);
      }
      throw e;
    }
  }

  async listByRun(
    runId: string,
    tx?: TransactionClient
  ): Promise<readonly WorkflowStepRecord[]> {
    return this.db(tx).workflowStep.findMany({
      where: { runId },
      orderBy: { createdAt: "asc" },
    });
  }
}
