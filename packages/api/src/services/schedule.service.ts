import type {
  IScheduleRepository,
  IWorkflowRepository,
  WorkflowScheduleRecord,
  PaginationParams,
  PaginatedResult,
  Json,
} from "@durable/storage";
import { validateCronExpression, getNextCronOccurrence } from "@durable/scheduler";
import { NotFoundError, BadRequestError } from "../errors/api-errors";
import type { CreateScheduleDto, UpdateScheduleDto } from "../schemas/schedule.schema";

export class ScheduleService {
  constructor(
    private readonly scheduleRepo: IScheduleRepository,
    private readonly workflowRepo: IWorkflowRepository
  ) {}

  async createSchedule(
    tenantId: string,
    dto: CreateScheduleDto
  ): Promise<WorkflowScheduleRecord> {
    const workflow = await this.workflowRepo.findById(tenantId, dto.workflowId);
    if (!workflow) {
      throw new NotFoundError("Workflow", dto.workflowId);
    }

    let nextRunAt: Date;

    if (dto.cronExpression) {
      // Validate recurrence
      try {
        validateCronExpression(dto.cronExpression, dto.timezone);
      } catch (err: any) {
        throw new BadRequestError(`Invalid cron expression: ${err.message}`);
      }
      nextRunAt = getNextCronOccurrence(dto.cronExpression, new Date(), dto.timezone);
    } else if (dto.runAt) {
      nextRunAt = dto.runAt;
    } else if (dto.delayMs !== undefined) {
      nextRunAt = new Date(Date.now() + dto.delayMs);
    } else {
      nextRunAt = new Date();
    }

    return this.scheduleRepo.create({
      tenantId,
      workflowId: dto.workflowId,
      cronExpression: dto.cronExpression ?? undefined,
      timezone: dto.timezone,
      input: (dto.input as unknown as Json) ?? undefined,
      missedExecutionPolicy: dto.missedExecutionPolicy,
      nextRunAt,
    });
  }

  async getSchedule(
    tenantId: string,
    scheduleId: string
  ): Promise<WorkflowScheduleRecord> {
    const schedule = await this.scheduleRepo.findById(tenantId, scheduleId);
    if (!schedule) {
      throw new NotFoundError("WorkflowSchedule", scheduleId);
    }
    return schedule;
  }

  async listSchedules(
    tenantId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WorkflowScheduleRecord>> {
    return this.scheduleRepo.list(tenantId, pagination);
  }

  async updateSchedule(
    tenantId: string,
    scheduleId: string,
    dto: UpdateScheduleDto
  ): Promise<WorkflowScheduleRecord> {
    const existing = await this.getSchedule(tenantId, scheduleId);

    let nextRunAt: Date | undefined = undefined;
    const cron = dto.cronExpression ?? existing.cronExpression;
    const tz = dto.timezone ?? existing.timezone;

    if (cron) {
      try {
        validateCronExpression(cron, tz);
      } catch (err: any) {
        throw new BadRequestError(`Invalid cron expression: ${err.message}`);
      }
      if (dto.cronExpression || dto.timezone) {
        nextRunAt = getNextCronOccurrence(cron, new Date(), tz);
      }
    }

    return this.scheduleRepo.update(tenantId, scheduleId, {
      cronExpression: dto.cronExpression,
      timezone: dto.timezone,
      input: (dto.input as unknown as Json) ?? undefined,
      missedExecutionPolicy: dto.missedExecutionPolicy,
      status: dto.status,
      nextRunAt,
    });
  }

  async deleteSchedule(
    tenantId: string,
    scheduleId: string
  ): Promise<WorkflowScheduleRecord> {
    await this.getSchedule(tenantId, scheduleId);
    return this.scheduleRepo.cancel(tenantId, scheduleId);
  }
}
