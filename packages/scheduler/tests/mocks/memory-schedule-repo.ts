import type {
  IScheduleRepository,
  CreateWorkflowScheduleInput,
  UpdateWorkflowScheduleInput,
  WorkflowScheduleRecord,
  PaginationParams,
  PaginatedResult,
} from "@durable/storage";
import { NotFoundError } from "@durable/storage";

export class InMemoryScheduleRepository implements IScheduleRepository {
  public schedules = new Map<string, WorkflowScheduleRecord>();

  async create(input: CreateWorkflowScheduleInput): Promise<WorkflowScheduleRecord> {
    const id = `sched-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    const record: WorkflowScheduleRecord = {
      id,
      tenantId: input.tenantId,
      workflowId: input.workflowId,
      cronExpression: input.cronExpression ?? null,
      timezone: input.timezone ?? "UTC",
      input: input.input ?? null,
      missedExecutionPolicy: input.missedExecutionPolicy ?? "SKIP",
      status: "ACTIVE",
      nextRunAt: input.nextRunAt,
      lastRunAt: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.schedules.set(id, record);
    return record;
  }

  async findById(tenantId: string, id: string): Promise<WorkflowScheduleRecord | null> {
    const s = this.schedules.get(id);
    return s && s.tenantId === tenantId ? s : null;
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateWorkflowScheduleInput
  ): Promise<WorkflowScheduleRecord> {
    const existing = await this.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundError("WorkflowSchedule", id);
    }

    const updated: WorkflowScheduleRecord = {
      ...existing,
      cronExpression: input.cronExpression !== undefined ? input.cronExpression : existing.cronExpression,
      timezone: input.timezone !== undefined ? input.timezone : existing.timezone,
      input: input.input !== undefined ? input.input : existing.input,
      missedExecutionPolicy: input.missedExecutionPolicy !== undefined ? input.missedExecutionPolicy : existing.missedExecutionPolicy,
      status: input.status !== undefined ? input.status : existing.status,
      nextRunAt: input.nextRunAt !== undefined ? input.nextRunAt : existing.nextRunAt,
      lastRunAt: input.lastRunAt !== undefined ? input.lastRunAt : existing.lastRunAt,
      leaseOwner: input.leaseOwner !== undefined ? input.leaseOwner : existing.leaseOwner,
      leaseExpiresAt: input.leaseExpiresAt !== undefined ? input.leaseExpiresAt : existing.leaseExpiresAt,
      updatedAt: new Date(),
    };
    this.schedules.set(id, updated);
    return updated;
  }

  async cancel(tenantId: string, id: string): Promise<WorkflowScheduleRecord> {
    return this.update(tenantId, id, {
      status: "CANCELLED",
      leaseOwner: null,
      leaseExpiresAt: null,
    });
  }

  async claimDueSchedules(
    schedulerId: string,
    limit: number,
    leaseDurationMs = 30_000,
    now: Date = new Date()
  ): Promise<readonly WorkflowScheduleRecord[]> {
    const claimed: WorkflowScheduleRecord[] = [];
    for (const [id, s] of this.schedules.entries()) {
      if (claimed.length >= limit) break;
      if (
        s.status === "ACTIVE" &&
        s.nextRunAt.getTime() <= now.getTime() &&
        (s.leaseOwner === null || (s.leaseExpiresAt && s.leaseExpiresAt.getTime() < now.getTime()))
      ) {
        const expiresAt = new Date(now.getTime() + leaseDurationMs);
        const updated: WorkflowScheduleRecord = {
          ...s,
          leaseOwner: schedulerId,
          leaseExpiresAt: expiresAt,
          updatedAt: now,
        };
        this.schedules.set(id, updated);
        claimed.push(updated);
      }
    }
    return claimed;
  }

  async recoverExpiredLeases(now: Date = new Date()): Promise<number> {
    let recovered = 0;
    for (const [id, s] of this.schedules.entries()) {
      if (
        s.status === "ACTIVE" &&
        s.leaseExpiresAt !== null &&
        s.leaseExpiresAt.getTime() < now.getTime()
      ) {
        this.schedules.set(id, {
          ...s,
          leaseOwner: null,
          leaseExpiresAt: null,
          updatedAt: now,
        });
        recovered++;
      }
    }
    return recovered;
  }

  async list(
    tenantId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WorkflowScheduleRecord>> {
    const all = Array.from(this.schedules.values()).filter((s) => s.tenantId === tenantId);
    const data = all.slice(pagination.offset, pagination.offset + pagination.limit);
    return { data, total: all.length, limit: pagination.limit, offset: pagination.offset };
  }
}
