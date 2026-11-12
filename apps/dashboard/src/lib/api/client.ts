import type {
  WorkflowItem,
  WorkflowVersionItem,
  WorkflowRunItem,
  WorkflowStepItem,
  WorkflowEventItem,
  ScheduleItem,
  WorkerItem,
  ApiKeyItem,
  OverviewMetrics,
  Pagination,
} from "../../types/orbit";
import {
  DEMO_WORKFLOWS,
  DEMO_RUNS,
  DEMO_STEPS,
  DEMO_EVENTS,
  DEMO_SCHEDULES,
  DEMO_WORKERS,
  DEMO_API_KEYS,
  DEMO_OVERVIEW_METRICS,
} from "../mock-data";

export interface ApiFetchOptions {
  limit?: number;
  offset?: number;
  status?: string;
  workflowId?: string;
  from?: string;
  to?: string;
}

// In-memory local stores for mutations when operating in local dev/demo boundary
let localRuns = [...DEMO_RUNS];
let localSchedules = [...DEMO_SCHEDULES];
let localApiKeys = [...DEMO_API_KEYS];
let localWorkflows = [...DEMO_WORKFLOWS];

export class OrbitApiClient {
  private baseUrl: string;
  private apiKey: string | undefined;

  constructor(baseUrl = process.env.ORBIT_API_URL || "http://localhost:3001", apiKey: string | undefined = process.env.ORBIT_API_KEY) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T; pagination?: Pagination; isLive: boolean }> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    } else if (typeof window !== "undefined" && (window as any).Clerk?.session) {
      try {
        const token = await (window as any).Clerk.session.getToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      } catch {
        // Clerk frontend session not yet initialized
      }
    } else if (typeof window === "undefined") {
      try {
        const { auth } = await import("@clerk/nextjs/server");
        const session = await auth();
        const token = await session.getToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      } catch {
        // Not in server request context or build time
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        return {
          data: json.data !== undefined ? json.data : json,
          pagination: json.pagination,
          isLive: true,
        };
      }
    } catch {
      // Backend not running on local port; fallback safely to local state
    }

    return { data: null as unknown as T, isLive: false };
  }

  // ─── Overview Metrics ────────────────────────────────────────────────────────
  async getOverviewMetrics(): Promise<{ data: OverviewMetrics; isLive: boolean }> {
    const live = await this.request<OverviewMetrics>("/v1/metrics/overview");
    if (live.isLive && live.data) {
      return live;
    }

    // Compute live metrics from runs state
    const total = localRuns.length;
    const completed = localRuns.filter((r) => r.status === "completed").length;
    const failed = localRuns.filter((r) => r.status === "failed").length;
    const running = localRuns.filter((r) => r.status === "running").length;
    const rate = total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 100;

    return {
      data: {
        totalRuns: DEMO_OVERVIEW_METRICS.totalRuns + (total - DEMO_RUNS.length),
        successfulRuns: DEMO_OVERVIEW_METRICS.successfulRuns,
        failedRuns: DEMO_OVERVIEW_METRICS.failedRuns + failed,
        runningExecutions: running || DEMO_OVERVIEW_METRICS.runningExecutions,
        registeredWorkflows: localWorkflows.length,
        activeWorkers: DEMO_WORKERS.filter((w: WorkerItem) => w.status === "active").length,
        successRate: rate,
        chartData: DEMO_OVERVIEW_METRICS.chartData,
      },
      isLive: false,
    };
  }

  // ─── Workflows ─────────────────────────────────────────────────────────────
  async listWorkflows(opts: ApiFetchOptions = {}): Promise<{ data: WorkflowItem[]; pagination: Pagination; isLive: boolean }> {
    const params = new URLSearchParams();
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.offset) params.set("offset", String(opts.offset));

    const live = await this.request<WorkflowItem[]>(`/v1/workflows?${params.toString()}`);
    if (live.isLive && Array.isArray(live.data)) {
      return { data: live.data, pagination: live.pagination || { total: live.data.length, limit: opts.limit || 50, offset: opts.offset || 0 }, isLive: true };
    }

    return {
      data: localWorkflows,
      pagination: { total: localWorkflows.length, limit: opts.limit || 50, offset: opts.offset || 0 },
      isLive: false,
    };
  }

  async getWorkflow(workflowId: string): Promise<{ data: WorkflowItem | null; isLive: boolean }> {
    const live = await this.request<WorkflowItem>(`/v1/workflows/${workflowId}`);
    if (live.isLive && live.data) return live;

    const found = localWorkflows.find((w) => w.id === workflowId || w.key === workflowId) || null;
    return { data: found, isLive: false };
  }

  async createWorkflow(payload: { key: string; name: string; metadata?: Record<string, unknown> }): Promise<{ data: WorkflowItem; isLive: boolean }> {
    const live = await this.request<WorkflowItem>("/v1/workflows", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (live.isLive && live.data) {
      return live;
    }

    const created: WorkflowItem = {
      id: `wf-${payload.key}`,
      tenantId: "00000000-0000-0000-0000-000000000001",
      key: payload.key,
      name: payload.name,
      metadata: payload.metadata || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runsCount: 0,
      latestVersion: 1,
    };
    localWorkflows.unshift(created);
    return { data: created, isLive: false };
  }

  // ─── Workflow Versions ─────────────────────────────────────────────────────
  async listWorkflowVersions(workflowId: string): Promise<{ data: WorkflowVersionItem[]; isLive: boolean }> {
    const live = await this.request<WorkflowVersionItem[]>(`/v1/workflows/${workflowId}/versions`);
    if (live.isLive && Array.isArray(live.data)) return { data: live.data, isLive: true };

    const versions: WorkflowVersionItem[] = [
      {
        id: `ver-${workflowId}-v3`,
        workflowId,
        version: 3,
        definition: { entrypoint: "main.ts", steps: ["validate", "authorize", "fulfill", "notify"] },
        checksum: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        isActive: true,
        activatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        runsCount: 840,
      },
      {
        id: `ver-${workflowId}-v2`,
        workflowId,
        version: 2,
        definition: { entrypoint: "main.ts", steps: ["validate", "authorize", "fulfill"] },
        checksum: "sha256:ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
        isActive: false,
        activatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
        runsCount: 1420,
      },
      {
        id: `ver-${workflowId}-v1`,
        workflowId,
        version: 1,
        definition: { entrypoint: "index.ts", steps: ["process"] },
        checksum: "sha256:4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce",
        isActive: false,
        activatedAt: new Date(Date.now() - 86400000 * 20).toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 22).toISOString(),
        runsCount: 520,
      },
    ];

    return { data: versions, isLive: false };
  }

  // ─── Runs ──────────────────────────────────────────────────────────────────
  async listRuns(opts: ApiFetchOptions = {}): Promise<{ data: WorkflowRunItem[]; pagination: Pagination; isLive: boolean }> {
    const params = new URLSearchParams();
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.offset) params.set("offset", String(opts.offset));
    if (opts.status) params.set("status", opts.status);
    if (opts.workflowId) params.set("workflowId", opts.workflowId);

    const live = await this.request<WorkflowRunItem[]>(`/v1/runs?${params.toString()}`);
    if (live.isLive && Array.isArray(live.data)) {
      return { data: live.data, pagination: live.pagination || { total: live.data.length, limit: opts.limit || 50, offset: opts.offset || 0 }, isLive: true };
    }

    let filtered = [...localRuns];
    if (opts.status && opts.status !== "all") {
      filtered = filtered.filter((r) => r.status.toLowerCase() === opts.status?.toLowerCase());
    }
    if (opts.workflowId) {
      filtered = filtered.filter((r) => r.workflowId === opts.workflowId || r.workflowKey === opts.workflowId);
    }

    const limit = opts.limit || 50;
    const offset = opts.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      data: paginated,
      pagination: { total: filtered.length, limit, offset },
      isLive: false,
    };
  }

  async getRun(runId: string): Promise<{ data: WorkflowRunItem | null; isLive: boolean }> {
    const live = await this.request<WorkflowRunItem>(`/v1/runs/${runId}`);
    if (live.isLive && live.data) return live;

    const found = localRuns.find((r) => r.id === runId) || null;
    return { data: found, isLive: false };
  }

  async cancelRun(runId: string): Promise<{ data: WorkflowRunItem | null; isLive: boolean }> {
    const live = await this.request<WorkflowRunItem>(`/v1/runs/${runId}/cancel`, { method: "POST" });
    if (live.isLive && live.data) return live;

    const index = localRuns.findIndex((r) => r.id === runId);
    if (index !== -1) {
      localRuns[index] = {
        ...localRuns[index]!,
        status: "cancelled",
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { data: localRuns[index]!, isLive: false };
    }
    return { data: null, isLive: false };
  }

  async retryRun(runId: string): Promise<{ data: WorkflowRunItem | null; isLive: boolean }> {
    const live = await this.request<WorkflowRunItem>(`/v1/runs/${runId}/retry`, { method: "POST" });
    if (live.isLive && live.data) return live;

    const index = localRuns.findIndex((r) => r.id === runId);
    if (index !== -1) {
      localRuns[index] = {
        ...localRuns[index]!,
        status: "running",
        revision: localRuns[index]!.revision + 1,
        startedAt: new Date().toISOString(),
        completedAt: null,
        error: null,
        updatedAt: new Date().toISOString(),
      };
      return { data: localRuns[index]!, isLive: false };
    }
    return { data: null, isLive: false };
  }

  async triggerRun(workflowId: string, input?: Record<string, unknown>, idempotencyKey?: string): Promise<{ data: WorkflowRunItem; isLive: boolean }> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

    const live = await this.request<WorkflowRunItem>(`/v1/workflows/${workflowId}/runs`, {
      method: "POST",
      headers,
      body: JSON.stringify(input || {}),
    });
    if (live.isLive && live.data) return live;

    const wf = localWorkflows.find((w) => w.id === workflowId || w.key === workflowId);
    const newRun: WorkflowRunItem = {
      id: `run-${crypto.randomUUID()}`,
      tenantId: "00000000-0000-0000-0000-000000000001",
      workflowId: wf?.id || workflowId,
      workflowKey: wf?.key || workflowId,
      workflowName: wf?.name || workflowId,
      versionId: "ver-current",
      versionNumber: wf?.latestVersion || 1,
      status: "running",
      input: input || {},
      output: null,
      error: null,
      revision: 1,
      idempotencyKey: idempotencyKey || null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggerType: "manual",
    };
    localRuns.unshift(newRun);
    return { data: newRun, isLive: false };
  }

  async getRunSteps(runId: string): Promise<{ data: WorkflowStepItem[]; isLive: boolean }> {
    const live = await this.request<WorkflowStepItem[]>(`/v1/runs/${runId}/steps`);
    if (live.isLive && Array.isArray(live.data)) return { data: live.data, isLive: true };

    const steps = DEMO_STEPS[runId] || [
      {
        id: `step-${runId}-1`,
        runId,
        stepKey: "initialize-execution",
        type: "activity",
        status: "completed",
        input: { payloadCheck: true },
        output: { validated: true },
        attempt: 1,
        startedAt: new Date(Date.now() - 30000).toISOString(),
        completedAt: new Date(Date.now() - 28000).toISOString(),
        createdAt: new Date(Date.now() - 31000).toISOString(),
        updatedAt: new Date(Date.now() - 28000).toISOString(),
        durationMs: 2000,
      },
      {
        id: `step-${runId}-2`,
        runId,
        stepKey: "execute-primary-task",
        type: "activity",
        status: "running",
        input: { batch: 1 },
        output: null,
        attempt: 1,
        startedAt: new Date(Date.now() - 27000).toISOString(),
        completedAt: null,
        createdAt: new Date(Date.now() - 27500).toISOString(),
        updatedAt: new Date(Date.now() - 10000).toISOString(),
        durationMs: 27000,
      },
    ];

    return { data: steps, isLive: false };
  }

  async getRunEvents(runId: string): Promise<{ data: WorkflowEventItem[]; isLive: boolean }> {
    const live = await this.request<WorkflowEventItem[]>(`/v1/runs/${runId}/events`);
    if (live.isLive && Array.isArray(live.data)) return { data: live.data, isLive: true };

    const events = DEMO_EVENTS[runId] || [
      {
        id: `evt-${runId}-1`,
        runId,
        sequence: 1,
        type: "run.started",
        payload: { trigger: "manual" },
        createdAt: new Date(Date.now() - 30000).toISOString(),
      },
      {
        id: `evt-${runId}-2`,
        runId,
        sequence: 2,
        type: "step.started",
        payload: { stepKey: "initialize-execution" },
        createdAt: new Date(Date.now() - 29000).toISOString(),
      },
    ];

    return { data: events, isLive: false };
  }

  // ─── Schedules ─────────────────────────────────────────────────────────────
  async listSchedules(): Promise<{ data: ScheduleItem[]; isLive: boolean }> {
    const live = await this.request<ScheduleItem[]>("/v1/schedules");
    if (live.isLive && Array.isArray(live.data)) return { data: live.data, isLive: true };

    return { data: localSchedules, isLive: false };
  }

  async createSchedule(payload: {
    workflowId: string;
    cronExpression: string;
    timezone?: string;
    input?: Record<string, unknown>;
  }): Promise<{ data: ScheduleItem; isLive: boolean }> {
    const live = await this.request<ScheduleItem>("/v1/schedules", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (live.isLive && live.data) return live;

    const wf = localWorkflows.find((w) => w.id === payload.workflowId || w.key === payload.workflowId);
    const created: ScheduleItem = {
      id: `sch-${Date.now()}`,
      tenantId: "00000000-0000-0000-0000-000000000001",
      workflowId: wf?.id || payload.workflowId,
      workflowKey: wf?.key || payload.workflowId,
      workflowName: wf?.name || payload.workflowId,
      cronExpression: payload.cronExpression,
      timezone: payload.timezone || "UTC",
      input: payload.input || null,
      missedExecutionPolicy: "skip",
      status: "active",
      nextRunAt: new Date(Date.now() + 3600000).toISOString(),
      lastRunAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localSchedules.unshift(created);
    return { data: created, isLive: false };
  }

  async updateSchedule(scheduleId: string, payload: Partial<ScheduleItem>): Promise<{ data: ScheduleItem | null; isLive: boolean }> {
    const live = await this.request<ScheduleItem>(`/v1/schedules/${scheduleId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    if (live.isLive && live.data) return live;

    const index = localSchedules.findIndex((s) => s.id === scheduleId);
    if (index !== -1) {
      localSchedules[index] = {
        ...localSchedules[index]!,
        ...payload,
        updatedAt: new Date().toISOString(),
      };
      return { data: localSchedules[index]!, isLive: false };
    }
    return { data: null, isLive: false };
  }

  async deleteSchedule(scheduleId: string): Promise<{ success: boolean; isLive: boolean }> {
    const live = await this.request<void>(`/v1/schedules/${scheduleId}`, { method: "DELETE" });
    if (live.isLive) return { success: true, isLive: true };

    localSchedules = localSchedules.filter((s) => s.id !== scheduleId);
    return { success: true, isLive: false };
  }

  // ─── Workers ───────────────────────────────────────────────────────────────
  async listWorkers(): Promise<{ data: WorkerItem[]; isLive: boolean }> {
    const live = await this.request<WorkerItem[]>("/v1/workers");
    if (live.isLive && Array.isArray(live.data)) return { data: live.data, isLive: true };

    return { data: DEMO_WORKERS, isLive: false };
  }

  // ─── API Keys ──────────────────────────────────────────────────────────────
  async listApiKeys(): Promise<{ data: ApiKeyItem[]; isLive: boolean }> {
    const live = await this.request<ApiKeyItem[]>("/v1/auth/api-keys");
    if (live.isLive && Array.isArray(live.data)) return { data: live.data, isLive: true };

    return { data: localApiKeys, isLive: false };
  }

  async createApiKey(name: string, expiresAt?: string): Promise<{ data: ApiKeyItem; isLive: boolean }> {
    const live = await this.request<ApiKeyItem>("/v1/auth/api-keys", {
      method: "POST",
      body: JSON.stringify({ name, expiresAt }),
    });
    if (live.isLive && live.data) return live;

    const secretSuffix = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const plainTextKey = `orb_live_${secretSuffix}`;
    const newKey: ApiKeyItem = {
      id: `key-${Date.now()}`,
      name,
      keyPrefix: plainTextKey.slice(0, 13),
      plainTextKey,
      revokedAt: null,
      expiresAt: expiresAt || null,
      createdAt: new Date().toISOString(),
    };
    localApiKeys.unshift(newKey);
    return { data: newKey, isLive: false };
  }

  async revokeApiKey(keyId: string): Promise<{ success: boolean; isLive: boolean }> {
    const live = await this.request<void>(`/v1/auth/api-keys/${keyId}`, { method: "DELETE" });
    if (live.isLive) return { success: true, isLive: true };

    const index = localApiKeys.findIndex((k) => k.id === keyId);
    if (index !== -1) {
      localApiKeys[index] = {
        ...localApiKeys[index]!,
        revokedAt: new Date().toISOString(),
      };
      return { success: true, isLive: false };
    }
    return { success: false, isLive: false };
  }
}

export const api = new OrbitApiClient();
