import type { HttpTransport } from "../client/transport";

export interface ScheduleRecordDto {
  id: string;
  tenantId: string;
  workflowId: string;
  cronExpression?: string | null;
  timezone: string;
  input?: unknown;
  missedExecutionPolicy: "SKIP" | "CATCH_UP" | "LATEST";
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  nextRunAt: string;
  lastRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleParams {
  workflowId: string;
  cronExpression?: string | undefined;
  runAt?: string | Date | undefined;
  delayMs?: number | undefined;
  timezone?: string | undefined;
  input?: unknown | undefined;
  missedExecutionPolicy?: "SKIP" | "CATCH_UP" | "LATEST" | undefined;
}

export interface UpdateScheduleParams {
  cronExpression?: string | undefined;
  timezone?: string | undefined;
  input?: unknown | undefined;
  missedExecutionPolicy?: "SKIP" | "CATCH_UP" | "LATEST" | undefined;
}

export class SchedulesClient {
  constructor(private readonly transport: HttpTransport) {}

  async create(params: CreateScheduleParams, signal?: AbortSignal): Promise<ScheduleRecordDto> {
    const runAtStr = params.runAt instanceof Date ? params.runAt.toISOString() : params.runAt;

    const res = await this.transport.request<ScheduleRecordDto>("/v1/schedules", {
      method: "POST",
      body: {
        ...params,
        ...(runAtStr && { runAt: runAtStr }),
      },
      signal,
    });
    return res.data;
  }

  async get(scheduleId: string, signal?: AbortSignal): Promise<ScheduleRecordDto> {
    const res = await this.transport.request<ScheduleRecordDto>(`/v1/schedules/${scheduleId}`, {
      method: "GET",
      signal,
    });
    return res.data;
  }

  async list(query?: { limit?: number; offset?: number }, signal?: AbortSignal) {
    const res = await this.transport.request<ScheduleRecordDto[]>("/v1/schedules", {
      method: "GET",
      query: {
        limit: query?.limit,
        offset: query?.offset,
      },
      signal,
    });
    return {
      schedules: res.data,
      pagination: res.pagination,
    };
  }

  async update(
    scheduleId: string,
    params: UpdateScheduleParams,
    signal?: AbortSignal
  ): Promise<ScheduleRecordDto> {
    const res = await this.transport.request<ScheduleRecordDto>(`/v1/schedules/${scheduleId}`, {
      method: "PATCH",
      body: params,
      signal,
    });
    return res.data;
  }

  async delete(scheduleId: string, signal?: AbortSignal): Promise<ScheduleRecordDto> {
    const res = await this.transport.request<ScheduleRecordDto>(`/v1/schedules/${scheduleId}`, {
      method: "DELETE",
      signal,
    });
    return res.data;
  }
}
