import { randomUUID } from "node:crypto";
import os from "node:os";
import type { PrismaClient, JobRecord, WorkerRecord } from "@durable/storage";
import { disconnect } from "@durable/storage";
import { ExecutionEngine as DurableEngine, type WorkflowDefinition } from "@durable/engine";
import type {
  WorkerOptions,
  WorkerConfig,
  WorkerState,
  JobHandler,
} from "./types";
import { WorkerLifecycle } from "./lifecycle/worker-lifecycle";
import { LeaseManager } from "./leases/lease-manager";
import { HeartbeatCoordinator } from "./heartbeat/heartbeat-coordinator";
import { JobClaimer } from "./claiming/job-claimer";
import { WorkflowRegistry } from "./execution/workflow-registry";
import { JobExecutor } from "./execution/job-executor";
import { RecoveryCoordinator } from "./recovery/recovery-coordinator";
import { WorkerShutdownError } from "./errors/worker-errors";

export class Worker {
  readonly config: WorkerConfig;
  readonly client: PrismaClient;

  private readonly lifecycle: WorkerLifecycle;
  private readonly leaseManager: LeaseManager;
  private readonly heartbeatCoordinator: HeartbeatCoordinator;
  private readonly jobClaimer: JobClaimer;
  private readonly registry: WorkflowRegistry;
  private readonly executor: JobExecutor;
  private readonly recoveryCoordinator: RecoveryCoordinator;

  // Active in-flight execution promises
  private readonly inFlightExecutions = new Set<Promise<unknown>>();
  private loopRunning = false;
  private loopSleepResolver: (() => void) | null = null;
  private readonly ownsClient: boolean;

  constructor(options: WorkerOptions & { ownsClient?: boolean }) {
    this.client = options.client;
    this.ownsClient = options.ownsClient ?? false;

    const workerId = options.workerId ?? randomUUID();
    const hostname = os.hostname?.() ?? "localhost";
    const name = options.name ?? `worker-${hostname}-${process.pid}-${workerId.slice(0, 8)}`;

    this.config = {
      tenantId: options.tenantId,
      workerId,
      name,
      queues: options.queues && options.queues.length > 0 ? options.queues : ["default"],
      concurrency: options.concurrency ?? 5,
      pollIntervalMs: options.pollIntervalMs ?? 1000,
      leaseDurationMs: options.leaseDurationMs ?? 30_000,
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? 10_000,
      shutdownGracePeriodMs: options.shutdownGracePeriodMs ?? 10_000,
      staleWorkerTimeoutMs: options.staleWorkerTimeoutMs ?? 60_000,
      autoRecoverLeases: options.autoRecoverLeases ?? true,
      recoveryIntervalMs: options.recoveryIntervalMs ?? 30_000,
      handleSignals: options.handleSignals ?? false,
      autoStartPolling: options.autoStartPolling ?? true,
      ...(options.metadata !== undefined && { metadata: options.metadata }),
    };

    // 1. Lifecycle
    this.lifecycle = new WorkerLifecycle(
      options.workerRepo,
      this.config,
      async () => {
        await this.stop();
      }
    );

    // 2. Lease Manager
    this.leaseManager = new LeaseManager({
      client: this.client,
      workerId: () => this.id,
      defaultLeaseDurationMs: this.config.leaseDurationMs,
    });

    // 3. Heartbeat Coordinator
    this.heartbeatCoordinator = new HeartbeatCoordinator({
      workerRepo: options.workerRepo,
      leaseManager: this.leaseManager,
      tenantId: this.config.tenantId,
      workerId: () => this.id,
      heartbeatIntervalMs: this.config.heartbeatIntervalMs,
      leaseDurationMs: this.config.leaseDurationMs,
    });

    // 4. Job Claimer
    this.jobClaimer = new JobClaimer({
      jobRepo: options.jobRepo,
      tenantId: this.config.tenantId,
      workerId: () => this.id,
      queues: this.config.queues,
      concurrency: this.config.concurrency,
      leaseDurationMs: this.config.leaseDurationMs,
      getActiveCount: () => this.leaseManager.getActiveCount(),
      canClaim: () => this.lifecycle.canClaimJobs(),
    });

    // 5. Workflow Registry & Engine
    this.registry = new WorkflowRegistry();

    let engineInstance = options.engine;
    if (!engineInstance && options.runRepo && options.stepRepo) {
      engineInstance = new DurableEngine({
        runRepo: options.runRepo,
        stepRepo: options.stepRepo,
        eventRepo: options.eventRepo,
      });
    }

    // 6. Job Executor
    this.executor = new JobExecutor({
      jobRepo: options.jobRepo,
      leaseManager: this.leaseManager,
      registry: this.registry,
      engine: engineInstance,
      workflowRepo: options.workflowRepo,
      versionRepo: options.versionRepo,
      runRepo: options.runRepo,
    });

    // 7. Recovery Coordinator
    this.recoveryCoordinator = new RecoveryCoordinator({
      client: this.client,
      jobRepo: options.jobRepo,
      workerRepo: options.workerRepo,
      tenantId: this.config.tenantId,
      staleWorkerTimeoutMs: this.config.staleWorkerTimeoutMs,
      recoveryIntervalMs: this.config.recoveryIntervalMs,
    });
  }

  get id(): string {
    return this.lifecycle.getWorkerRecord()?.id ?? this.config.workerId;
  }

  get tenantId(): string {
    return this.config.tenantId;
  }

  getState(): WorkerState {
    return this.lifecycle.getState();
  }

  getWorkerRecord(): WorkerRecord | null {
    return this.lifecycle.getWorkerRecord();
  }

  getActiveJobCount(): number {
    return this.leaseManager.getActiveCount();
  }

  /**
   * Registers a workflow definition.
   */
  registerWorkflow(workflow: WorkflowDefinition<any, any>): void {
    this.registry.registerWorkflow(workflow);
  }

  /**
   * Registers a custom job handler.
   */
  registerHandler(type: string, handler: JobHandler): void {
    this.registry.registerHandler(type, handler);
  }

  /**
   * Starts the worker:
   * 1. Registers in storage (status: ACTIVE)
   * 2. Starts heartbeat timer
   * 3. Starts background recovery if enabled
   * 4. Starts polling loop
   */
  async start(): Promise<WorkerRecord> {
    const record = await this.lifecycle.registerAndStart();

    // Start background coordinators
    this.heartbeatCoordinator.start();
    if (this.config.autoRecoverLeases) {
      this.recoveryCoordinator.start();
    }

    // Start claiming loop
    if (this.config.autoStartPolling) {
      this.startPollingLoop();
    }

    return record;
  }

  /**
   * Explicitly starts the continuous background polling loop.
   */
  startPolling(): void {
    this.startPollingLoop();
  }

  /**
   * Temporarily pauses job claiming. Active executions continue.
   */
  pause(): void {
    this.lifecycle.pause();
  }

  /**
   * Resumes job claiming if paused.
   */
  resume(): void {
    this.lifecycle.resume();
    this.wakeUpPollingLoop();
  }

  /**
   * Manually steps the worker once: claims available jobs and returns count claimed.
   */
  async tick(): Promise<number> {
    if (!this.lifecycle.canClaimJobs()) {
      return 0;
    }

    const available = this.jobClaimer.getAvailableCapacity();
    if (available <= 0) {
      return 0;
    }

    const jobs = await this.jobClaimer.claimBatch(available);
    for (const job of jobs) {
      this.spawnExecution(job);
    }

    return jobs.length;
  }

  /**
   * Graceful shutdown:
   * 1. Stops claiming new jobs
   * 2. Allows active jobs a configurable grace period
   * 3. Aborts cooperative executions after the grace period
   * 4. Safely releases/expires remaining leases
   * 5. Sets worker status to INACTIVE in persistence
   * 6. Closes database resources if owned by the worker
   */
  async stop(options?: { gracePeriodMs?: number }): Promise<void> {
    if (this.lifecycle.isStopped()) {
      return;
    }

    // 1. Begin stopping (immediately prevents new claims)
    this.lifecycle.beginStopping();

    // Stop loops and background timers
    this.loopRunning = false;
    this.wakeUpPollingLoop();
    this.heartbeatCoordinator.stop();
    this.recoveryCoordinator.stop();

    const gracePeriodMs =
      options?.gracePeriodMs ?? this.config.shutdownGracePeriodMs;

    // 2. Wait for active in-flight jobs within grace period
    if (this.inFlightExecutions.size > 0) {
      const allDone = Promise.all(Array.from(this.inFlightExecutions));
      let timeoutHandle: ReturnType<typeof setTimeout>;
      const timerPromise = new Promise((resolve) => {
        timeoutHandle = setTimeout(resolve, gracePeriodMs);
      });

      await Promise.race([allDone, timerPromise]);
      clearTimeout(timeoutHandle!);

      // 3. If any executions remain, cooperatively abort them
      if (this.inFlightExecutions.size > 0) {
        this.leaseManager.abortAll(
          new WorkerShutdownError(
            this.id,
            `Worker "${this.id}" grace period expired during shutdown`
          )
        );

        // Give cooperative abort a short moment (500ms) to clean up
        const shortWait = new Promise((resolve) => setTimeout(resolve, 500));
        await Promise.race([
          Promise.all(Array.from(this.inFlightExecutions)),
          shortWait,
        ]);
      }
    }

    // 4. Safely recover any expired leases if needed
    if (this.config.autoRecoverLeases) {
      try {
        await this.recoveryCoordinator.recoverExpiredJobLeases();
      } catch (err) {
        console.error("Error recovering leases during shutdown:", err);
      }
    }

    // 5. Complete shutdown (marks worker record as INACTIVE)
    await this.lifecycle.completeShutdown();

    // 6. Close database resources if owned by worker
    if (this.ownsClient) {
      await disconnect(this.client);
    }
  }

  /**
   * Spawns an asynchronous job execution in the background, tracking its promise.
   */
  private spawnExecution(job: JobRecord): void {
    const promise = this.executor
      .execute(job)
      .catch((err) => {
        console.error(`Unhandled error executing job "${job.id}":`, err);
      })
      .finally(() => {
        this.inFlightExecutions.delete(promise);
        // Wake up polling loop since a concurrency slot freed up
        this.wakeUpPollingLoop();
      });

    this.inFlightExecutions.add(promise);
  }

  /**
   * Continuous background polling loop.
   */
  private startPollingLoop(): void {
    if (this.loopRunning) {
      return;
    }
    this.loopRunning = true;

    void (async () => {
      while (this.loopRunning) {
        try {
          if (!this.loopRunning) {
            break;
          }
          if (this.lifecycle.canClaimJobs()) {
            const claimed = await this.tick();
            if (claimed === 0 && this.loopRunning) {
              // Wait for poll interval or wakeup
              await this.sleep(this.config.pollIntervalMs);
            }
          } else {
            // Paused or not running, wait
            if (this.loopRunning) {
              await this.sleep(this.config.pollIntervalMs);
            }
          }
        } catch (err) {
          if (this.loopRunning) {
            console.error(`Error in worker polling loop:`, err);
            await this.sleep(this.config.pollIntervalMs);
          }
        }
      }
    })();
  }

  private wakeUpPollingLoop(): void {
    if (this.loopSleepResolver) {
      this.loopSleepResolver();
      this.loopSleepResolver = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const resolver = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        resolve();
      };

      this.loopSleepResolver = resolver;
      timer = setTimeout(resolver, ms);
    });
  }
}
