import type { HttpTransport } from "../client/transport";

export interface WorkflowRunRecordDto {
  id: string;
  tenantId: string;
  workflowId: string;
  versionId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  input?: unknown;
  output?: unknown;
  error?: unknown;
  revision: number;
  idempotencyKey?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepRecordDto {
  id: string;
  runId: string;
  stepKey: string;
  type: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED" | "CANCELLED";
  input?: unknown;
  output?: unknown;
  error?: unknown;
  attempt: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEventRecordDto {
  id: string;
  runId: string;
  type: string;
  payload?: unknown;
  sequence: number;
  createdAt: string;
}

export interface CreateRunOptions {
  versionId?: string | undefined;
  input?: unknown | undefined;
  idempotencyKey?: string | undefined;
}

export interface CreateRunResult {
  run: WorkflowRunRecordDto;
  isIdempotentReplay: boolean;
}

export interface ListRunsFilter {
  status?: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | undefined;
  workflowId?: string | undefined;
  from?: Date | string | undefined;
  to?: Date | string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export class RunsClient {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Starts a new workflow run.
   */
  async create(
    workflowId: string,
    options?: CreateRunOptions,
    signal?: AbortSignal
  ): Promise<CreateRunResult> {
    const res = await this.transport.request<WorkflowRunRecordDto>(
      `/v1/workflows/${workflowId}/runs`,
      {
        method: "POST",
        body: {
          versionId: options?.versionId,
          input: options?.input,
        },
        idempotencyKey: options?.idempotencyKey,
        signal,
      }
    );

    return {
      run: res.data,
      isIdempotentReplay: res.isIdempotentReplay ?? false,
    };
  }

  /**
   * Retrieves workflow run details by run ID.
   */
  async get(runId: string, signal?: AbortSignal): Promise<WorkflowRunRecordDto> {
    const res = await this.transport.request<WorkflowRunRecordDto>(`/v1/runs/${runId}`, {
      method: "GET",
      signal,
    });
    return res.data;
  }

  /**
   * Lists workflow runs with filtering and pagination.
   */
  async list(filter?: ListRunsFilter, signal?: AbortSignal) {
    const fromStr = filter?.from instanceof Date ? filter.from.toISOString() : filter?.from;
    const toStr = filter?.to instanceof Date ? filter.to.toISOString() : filter?.to;

    const res = await this.transport.request<WorkflowRunRecordDto[]>("/v1/runs", {
      method: "GET",
      query: {
        status: filter?.status,
        workflowId: filter?.workflowId,
        from: fromStr,
        to: toStr,
        limit: filter?.limit,
        offset: filter?.offset,
      },
      signal,
    });

    return {
      runs: res.data,
      pagination: res.pagination,
    };
  }

  /**
   * Cancels an active or pending workflow run.
   */
  async cancel(runId: string, signal?: AbortSignal): Promise<WorkflowRunRecordDto> {
    const res = await this.transport.request<WorkflowRunRecordDto>(`/v1/runs/${runId}/cancel`, {
      method: "POST",
      signal,
    });
    return res.data;
  }

  /**
   * Retries a failed workflow run.
   */
  async retry(runId: string, signal?: AbortSignal): Promise<WorkflowRunRecordDto> {
    const res = await this.transport.request<WorkflowRunRecordDto>(`/v1/runs/${runId}/retry`, {
      method: "POST",
      signal,
    });
    return res.data;
  }

  /**
   * Inspects the step execution history for a run.
   */
  async steps(runId: string, signal?: AbortSignal): Promise<WorkflowStepRecordDto[]> {
    const res = await this.transport.request<WorkflowStepRecordDto[]>(`/v1/runs/${runId}/steps`, {
      method: "GET",
      signal,
    });
    return res.data;
  }

  /**
   * Inspects the event audit trail for a run.
   */
  async events(runId: string, signal?: AbortSignal): Promise<WorkflowEventRecordDto[]> {
    const res = await this.transport.request<WorkflowEventRecordDto[]>(`/v1/runs/${runId}/events`, {
      method: "GET",
      signal,
    });
    return res.data;
  }
}
