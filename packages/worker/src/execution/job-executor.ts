import type {
  IJobRepository,
  IWorkflowRepository,
  IWorkflowVersionRepository,
  IWorkflowRunRepository,
  JobRecord,
  Json,
} from "@durable/storage";
import { ConflictError } from "@durable/storage";
import type { ExecutionEngine, WorkflowDefinition } from "@durable/engine";
import type { LeaseManager } from "../leases/lease-manager";
import type { WorkflowRegistry } from "./workflow-registry";
import type { WorkflowDispatchPayload, JobExecutionResult } from "../types";
import {
  InvalidJobPayloadError,
  WorkflowNotFoundError,
  LeaseLostError,
} from "../errors/worker-errors";

export interface JobExecutorOptions {
  readonly jobRepo: IJobRepository;
  readonly leaseManager: LeaseManager;
  readonly registry: WorkflowRegistry;
  readonly engine?: ExecutionEngine | undefined;
  readonly workflowRepo?: IWorkflowRepository | undefined;
  readonly versionRepo?: IWorkflowVersionRepository | undefined;
  readonly runRepo?: IWorkflowRunRepository | undefined;
}

export function serializeError(error: unknown): Json {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  try {
    return JSON.parse(JSON.stringify(error)) as Json;
  } catch {
    return { message: String(error) };
  }
}

export class JobExecutor {
  private readonly jobRepo: IJobRepository;
  private readonly leaseManager: LeaseManager;
  private readonly registry: WorkflowRegistry;
  private readonly engine?: ExecutionEngine | undefined;
  private readonly workflowRepo?: IWorkflowRepository | undefined;
  private readonly versionRepo?: IWorkflowVersionRepository | undefined;
  private readonly runRepo?: IWorkflowRunRepository | undefined;

  constructor(options: JobExecutorOptions) {
    this.jobRepo = options.jobRepo;
    this.leaseManager = options.leaseManager;
    this.registry = options.registry;
    this.engine = options.engine;
    this.workflowRepo = options.workflowRepo;
    this.versionRepo = options.versionRepo;
    this.runRepo = options.runRepo;
  }

  /**
   * Executes a claimed job to completion or failure.
   * Ensures that a worker that lost its lease cannot commit results.
   */
  async execute(job: JobRecord): Promise<JobExecutionResult> {
    const lease = this.leaseManager.acquire(job);
    const signal = lease.abortController.signal;

    try {
      // 1. Check if a custom handler is registered for this job type
      const customHandler = this.registry.getHandler(job.type);
      if (customHandler) {
        const output = await customHandler(job, signal);
        return await this.commitSuccess(job, lease.fencingToken, output);
      }

      // 2. Validate workflow payload
      const payload = this.validateWorkflowPayload(job);

      // 3. Resolve workflow definition
      const { workflowDef, workflowId, versionId } =
        await this.resolveWorkflow(job.tenantId, payload);

      if (!this.engine) {
        throw new Error(
          `ExecutionEngine is not configured on worker to execute workflow "${workflowDef.name}"`
        );
      }

      // 4. Invoke @durable/engine (resume existing run or start new run)
      let runResult;
      if (payload.runId) {
        runResult = await this.engine.resume(
          job.tenantId,
          payload.runId,
          workflowDef
        );
      } else {
        runResult = await this.engine.start({
          tenantId: job.tenantId,
          workflowId,
          versionId,
          workflow: workflowDef,
          input: payload.input,
        });
      }

      // 5. Handle engine result
      if (runResult.status === "COMPLETED") {
        return await this.commitSuccess(
          job,
          lease.fencingToken,
          runResult.output
        );
      } else if (runResult.status === "CANCELLED") {
        return await this.commitCancelled(job, lease.fencingToken);
      } else {
        return await this.commitFailure(
          job,
          lease.fencingToken,
          runResult.error ?? new Error("Workflow failed")
        );
      }
    } catch (error) {
      return await this.handleExecutionError(job, lease.fencingToken, error, signal);
    } finally {
      this.leaseManager.release(job.id);
    }
  }

  private validateWorkflowPayload(job: JobRecord): WorkflowDispatchPayload {
    const payload = job.payload as WorkflowDispatchPayload | null;
    if (!payload || typeof payload !== "object") {
      throw new InvalidJobPayloadError(job.id, "Payload must be an object");
    }

    if (!payload.workflowId && !payload.workflowKey && !payload.runId) {
      throw new InvalidJobPayloadError(
        job.id,
        "Payload must specify workflowId, workflowKey, or runId"
      );
    }

    return payload;
  }

  private async resolveWorkflow(
    tenantId: string,
    payload: WorkflowDispatchPayload
  ): Promise<{
    workflowDef: WorkflowDefinition<any, any>;
    workflowId: string;
    versionId: string;
  }> {
    let workflowKey = payload.workflowKey;
    let workflowId = payload.workflowId;
    let versionId = payload.versionId;

    // If runId is provided but workflowId or key is missing, look up the run
    if (payload.runId && (!workflowKey || !workflowId || !versionId)) {
      if (this.runRepo) {
        const run = await this.runRepo.findById(tenantId, payload.runId);
        if (run) {
          workflowId = run.workflowId;
          versionId = run.versionId;
        }
      }
    }

    // If workflowId is known but workflowKey is not, look up workflow
    if (workflowId && !workflowKey && this.workflowRepo) {
      const wf = await this.workflowRepo.findById(tenantId, workflowId);
      if (wf) {
        workflowKey = wf.key;
      }
    }

    // Resolve target version number if versionId is present
    let targetVersionNumber: number | undefined = undefined;
    if (versionId && this.versionRepo) {
      const ver = await this.versionRepo.findById(versionId);
      if (ver) {
        targetVersionNumber = ver.version;
      }
    }

    // Try finding workflow definition in registry
    let workflowDef: WorkflowDefinition<any, any> | undefined;
    if (workflowKey) {
      workflowDef = this.registry.getWorkflow(workflowKey, targetVersionNumber);
    }
    if (!workflowDef && workflowId) {
      workflowDef = this.registry.getWorkflow(workflowId, targetVersionNumber);
    }

    if (!workflowDef) {
      throw new WorkflowNotFoundError(
        workflowKey ?? workflowId ?? "unknown",
        tenantId
      );
    }

    // Resolve versionId if still missing
    if (!versionId && workflowId && this.versionRepo) {
      const activeVer = await this.versionRepo.findActiveVersion(workflowId);
      if (activeVer) {
        versionId = activeVer.id;
      }
    }

    return {
      workflowDef,
      workflowId: workflowId ?? "unknown",
      versionId: versionId ?? "unknown",
    };
  }

  private async commitSuccess(
    job: JobRecord,
    fencingToken: bigint,
    output?: unknown
  ): Promise<JobExecutionResult> {
    try {
      await this.jobRepo.update(job.tenantId, job.id, {
        status: "COMPLETED",
        completedAt: new Date(),
        expectedFencingToken: fencingToken,
      });
      return {
        jobId: job.id,
        status: "COMPLETED",
        output,
        fencingToken,
      };
    } catch (err) {
      if (err instanceof ConflictError) {
        // Lease expired or fencing token changed - stale worker cannot commit
        console.warn(
          `Stale worker prevented from committing success for job "${job.id}" (fencing token: ${fencingToken})`
        );
      }
      throw err;
    }
  }

  private async commitCancelled(
    job: JobRecord,
    fencingToken: bigint
  ): Promise<JobExecutionResult> {
    try {
      await this.jobRepo.update(job.tenantId, job.id, {
        status: "CANCELLED",
        completedAt: new Date(),
        expectedFencingToken: fencingToken,
      });
      return {
        jobId: job.id,
        status: "COMPLETED",
        fencingToken,
      };
    } catch (err) {
      if (err instanceof ConflictError) {
        console.warn(
          `Stale worker prevented from committing cancellation for job "${job.id}"`
        );
      }
      throw err;
    }
  }

  private async commitFailure(
    job: JobRecord,
    fencingToken: bigint,
    error: unknown
  ): Promise<JobExecutionResult> {
    try {
      await this.jobRepo.update(job.tenantId, job.id, {
        status: "FAILED",
        completedAt: new Date(),
        error: serializeError(error),
        expectedFencingToken: fencingToken,
      });
      return {
        jobId: job.id,
        status: "FAILED",
        error,
        fencingToken,
      };
    } catch (err) {
      if (err instanceof ConflictError) {
        console.warn(
          `Stale worker prevented from committing failure for job "${job.id}"`
        );
      }
      throw err;
    }
  }

  private async handleExecutionError(
    job: JobRecord,
    fencingToken: bigint,
    error: unknown,
    signal: AbortSignal
  ): Promise<JobExecutionResult> {
    // If lease was lost, DO NOT commit stale results to database!
    if (error instanceof LeaseLostError || signal.aborted) {
      const reason = signal.reason ?? error;
      console.warn(
        `Job "${job.id}" aborted due to lost lease. Suppressing database update.`
      );
      return {
        jobId: job.id,
        status: "FAILED",
        error: reason,
        fencingToken,
      };
    }

    try {
      return await this.commitFailure(job, fencingToken, error);
    } catch (updateErr) {
      // If update fails due to conflict (stale fencing token), suppress
      if (updateErr instanceof ConflictError) {
        return {
          jobId: job.id,
          status: "FAILED",
          error,
          fencingToken,
        };
      }
      throw updateErr;
    }
  }
}
