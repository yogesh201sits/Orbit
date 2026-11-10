import { z } from "zod";
import type { OrbitConfig, ResolvedOrbitConfig } from "./config";
import { resolveConfig } from "./config";
import { HttpTransport } from "./transport";
import { defineWorkflow } from "../workflow/workflow";
import type {
  WorkflowOptions,
  WorkflowHandler,
  OrbitWorkflow,
} from "../workflow/types";
import { WorkflowRegistry } from "../registry/workflow-registry";
import { registerInWorker, type RegisterableWorker } from "../registry/worker-bridge";
import { WorkflowsClient } from "../management/workflows";
import { RunsClient } from "../management/runs";
import { SchedulesClient } from "../management/schedules";

export class Orbit {
  readonly config: ResolvedOrbitConfig;
  readonly transport: HttpTransport;
  readonly registry: WorkflowRegistry;

  /**
   * Workflow management API client.
   */
  readonly workflows: WorkflowsClient;

  /**
   * Workflow run execution and inspection API client.
   */
  readonly runs: RunsClient;

  /**
   * Workflow schedules API client.
   */
  readonly schedules: SchedulesClient;

  constructor(options?: OrbitConfig) {
    this.config = resolveConfig(options);
    this.transport = new HttpTransport(this.config);
    this.registry = new WorkflowRegistry();

    this.workflows = new WorkflowsClient(this.transport);
    this.runs = new RunsClient(this.transport);
    this.schedules = new SchedulesClient(this.transport);
  }

  /**
   * Defines a durable function-first workflow.
   *
   * @example
   * ```ts
   * export const processOrder = orbit.workflow(
   *   { id: "process-order", version: 1 },
   *   async ({ input, step }) => {
   *     const order = await step.run("validate", () => validate(input.orderId));
   *     return { order, success: true };
   *   }
   * );
   * ```
   */
  /**
   * Defines a durable function-first workflow with automatic Zod input/output schema inference.
   */
  workflow<
    TInputSchema extends z.ZodType<any>,
    TOutputSchema extends z.ZodType<any> = z.ZodType<any>,
    TInput = z.infer<TInputSchema>,
    TOutput = z.infer<TOutputSchema>
  >(
    options: WorkflowOptions<TInput, TOutput, TInputSchema, TOutputSchema> & { inputSchema: TInputSchema },
    handler: WorkflowHandler<TInput, TOutput>
  ): OrbitWorkflow<TInput, TOutput>;
  workflow<
    TInput = any,
    TOutput = any
  >(
    options: WorkflowOptions<TInput, TOutput>,
    handler: WorkflowHandler<TInput, TOutput>
  ): OrbitWorkflow<TInput, TOutput>;
  workflow(options: any, handler: any): OrbitWorkflow<any, any> {
    const wf = defineWorkflow(options, handler);
    // Auto-register in local registry
    this.registry.register(wf);
    return wf;
  }

  /**
   * Registers one or more workflows with the Orbit Control Plane (API).
   * Publishes workflow metadata and active version definitions without arbitrary JS code.
   */
  async register(
    workflows: OrbitWorkflow | OrbitWorkflow[],
    signal?: AbortSignal
  ): Promise<{ registered: string[] }> {
    const items = Array.isArray(workflows) ? workflows : [workflows];
    const registeredIds: string[] = [];

    // List existing workflows to find matching keys
    const existingList = await this.workflows.list({ limit: 100 }, signal);
    const existingByKey = new Map<string, string>();
    for (const w of existingList.workflows) {
      existingByKey.set(w.key, w.id);
    }

    for (const wf of items) {
      // Register in local registry
      this.registry.register(wf);

      const payload = wf.toMetadataPayload();
      let workflowId = existingByKey.get(payload.key);

      // 1. Create workflow if it does not exist
      if (!workflowId) {
        try {
          const created = await this.workflows.create(
            {
              key: payload.key,
              name: payload.name,
              metadata: payload.metadata,
            },
            signal
          );
          workflowId = created.id;
          existingByKey.set(payload.key, workflowId);
        } catch (err: any) {
          // If conflict (e.g. race condition), fetch again
          const refreshed = await this.workflows.list({ limit: 100 }, signal);
          const found = refreshed.workflows.find((w) => w.key === payload.key);
          if (found) {
            workflowId = found.id;
          } else {
            throw err;
          }
        }
      }

      // 2. Register version
      try {
        const verRecord = await this.workflows.createVersion(
          workflowId,
          {
            version: payload.version.version,
            definition: payload.version.definition,
            checksum: payload.version.checksum,
            isActive: true,
          },
          signal
        );
        // Ensure version is activated
        if (!verRecord.isActive) {
          await this.workflows.activateVersion(workflowId, verRecord.id, signal);
        }
      } catch (err: any) {
        // If version already exists (409), find and activate it
        if (err.statusCode === 409 || err.code === "CONFLICT") {
          const versions = await this.workflows.listVersions(workflowId, { limit: 100 }, signal);
          const existingVer = versions.versions.find((v) => v.version === payload.version.version);
          if (existingVer && !existingVer.isActive) {
            await this.workflows.activateVersion(workflowId, existingVer.id, signal);
          }
        } else {
          throw err;
        }
      }

      registeredIds.push(wf.id);
    }

    return { registered: registeredIds };
  }

  /**
   * Registers SDK workflows into a worker instance for execution.
   */
  registerInWorker(
    worker: RegisterableWorker,
    workflows?: OrbitWorkflow | OrbitWorkflow[]
  ): void {
    const items = workflows
      ? Array.isArray(workflows)
        ? workflows
        : [workflows]
      : this.registry.list();

    registerInWorker(worker, items);
  }
}
