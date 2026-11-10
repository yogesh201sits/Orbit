import type { HttpTransport } from "../client/transport";

export interface WorkflowRecordDto {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowVersionRecordDto {
  id: string;
  workflowId: string;
  version: number;
  definition: Record<string, unknown>;
  checksum: string;
  isActive: boolean;
  activatedAt?: string | null;
  createdAt: string;
}

export interface ListWorkflowsQuery {
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface CreateWorkflowParams {
  key: string;
  name: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface UpdateWorkflowParams {
  name?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface CreateVersionParams {
  version: number;
  definition: Record<string, unknown>;
  checksum?: string | undefined;
  isActive?: boolean | undefined;
}

export class WorkflowsClient {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Lists all workflows for the authenticated tenant.
   */
  async list(query?: ListWorkflowsQuery, signal?: AbortSignal) {
    const res = await this.transport.request<WorkflowRecordDto[]>("/v1/workflows", {
      method: "GET",
      query: {
        limit: query?.limit,
        offset: query?.offset,
      },
      signal,
    });
    return {
      workflows: res.data,
      pagination: res.pagination,
    };
  }

  /**
   * Retrieves a workflow by its unique ID.
   */
  async get(workflowId: string, signal?: AbortSignal): Promise<WorkflowRecordDto> {
    const res = await this.transport.request<WorkflowRecordDto>(`/v1/workflows/${workflowId}`, {
      method: "GET",
      signal,
    });
    return res.data;
  }

  /**
   * Creates a new workflow record.
   */
  async create(params: CreateWorkflowParams, signal?: AbortSignal): Promise<WorkflowRecordDto> {
    const res = await this.transport.request<WorkflowRecordDto>("/v1/workflows", {
      method: "POST",
      body: params,
      signal,
    });
    return res.data;
  }

  /**
   * Updates an existing workflow.
   */
  async update(
    workflowId: string,
    params: UpdateWorkflowParams,
    signal?: AbortSignal
  ): Promise<WorkflowRecordDto> {
    const res = await this.transport.request<WorkflowRecordDto>(`/v1/workflows/${workflowId}`, {
      method: "PATCH",
      body: params,
      signal,
    });
    return res.data;
  }

  /**
   * Deletes a workflow.
   */
  async delete(workflowId: string, signal?: AbortSignal): Promise<void> {
    await this.transport.request<void>(`/v1/workflows/${workflowId}`, {
      method: "DELETE",
      signal,
    });
  }

  /**
   * Registers a new version for a workflow.
   */
  async createVersion(
    workflowId: string,
    params: CreateVersionParams,
    signal?: AbortSignal
  ): Promise<WorkflowVersionRecordDto> {
    const res = await this.transport.request<WorkflowVersionRecordDto>(
      `/v1/workflows/${workflowId}/versions`,
      {
        method: "POST",
        body: params,
        signal,
      }
    );
    return res.data;
  }

  /**
   * Lists versions of a workflow.
   */
  async listVersions(
    workflowId: string,
    query?: ListWorkflowsQuery,
    signal?: AbortSignal
  ) {
    const res = await this.transport.request<WorkflowVersionRecordDto[]>(
      `/v1/workflows/${workflowId}/versions`,
      {
        method: "GET",
        query: {
          limit: query?.limit,
          offset: query?.offset,
        },
        signal,
      }
    );
    return {
      versions: res.data,
      pagination: res.pagination,
    };
  }

  /**
   * Activates a specific version for a workflow.
   */
  async activateVersion(
    workflowId: string,
    versionId: string,
    signal?: AbortSignal
  ): Promise<WorkflowVersionRecordDto> {
    const res = await this.transport.request<WorkflowVersionRecordDto>(
      `/v1/workflows/${workflowId}/versions/${versionId}/activate`,
      {
        method: "POST",
        signal,
      }
    );
    return res.data;
  }
}
