import type { IWorkerRepository, WorkerRecord } from "@durable/storage";
import type { WorkerConfig, WorkerState } from "../types";
import { WorkerError, WorkerRegistrationError } from "../errors/worker-errors";

export class WorkerLifecycle {
  private state: WorkerState = "INITIALIZING";
  private workerRecord: WorkerRecord | null = null;
  private signalHandlersInstalled = false;
  private readonly boundSignalHandler: () => void;

  constructor(
    private readonly workerRepo: IWorkerRepository,
    private readonly config: WorkerConfig,
    private readonly onSignalShutdown?: () => Promise<void>
  ) {
    this.boundSignalHandler = () => {
      if (this.onSignalShutdown) {
        void this.onSignalShutdown();
      }
    };
  }

  getState(): WorkerState {
    return this.state;
  }

  isRunning(): boolean {
    return this.state === "RUNNING";
  }

  isPaused(): boolean {
    return this.state === "PAUSED";
  }

  isStopping(): boolean {
    return this.state === "STOPPING";
  }

  isStopped(): boolean {
    return this.state === "STOPPED";
  }

  canClaimJobs(): boolean {
    return this.state === "RUNNING";
  }

  getWorkerRecord(): WorkerRecord | null {
    return this.workerRecord;
  }

  /**
   * Registers the worker in storage (if not already registered) and sets state to RUNNING.
   */
  async registerAndStart(): Promise<WorkerRecord> {
    if (this.state === "RUNNING") {
      return this.workerRecord!;
    }
    if (this.state === "STOPPING" || this.state === "STOPPED") {
      throw new WorkerError(
        `Cannot start worker in "${this.state}" state`
      );
    }

    try {
      if (!this.workerRecord) {
        // Register with storage
        this.workerRecord = await this.workerRepo.create({
          tenantId: this.config.tenantId,
          name: this.config.name,
          queues: this.config.queues,
          ...(this.config.metadata !== undefined && {
            metadata: this.config.metadata,
          }),
        });
      } else {
        // Re-activate if was previously inactive
        await this.workerRepo.heartbeat(
          this.config.tenantId,
          this.workerRecord.id
        );
      }

      this.state = "RUNNING";

      if (this.config.handleSignals && !this.signalHandlersInstalled) {
        this.installSignalHandlers();
      }

      return this.workerRecord;
    } catch (err) {
      throw new WorkerRegistrationError(
        this.config.workerId,
        this.config.tenantId,
        err
      );
    }
  }

  /**
   * Pauses job claiming. Active jobs continue executing.
   */
  pause(): void {
    if (this.state === "RUNNING") {
      this.state = "PAUSED";
    }
  }

  /**
   * Resumes job claiming if paused.
   */
  resume(): void {
    if (this.state === "PAUSED") {
      this.state = "RUNNING";
    }
  }

  /**
   * Begins the stopping process. Prevents new claims.
   */
  beginStopping(): void {
    if (this.state === "STOPPED") {
      return;
    }
    this.state = "STOPPING";
  }

  /**
   * Completes shutdown: marks the worker record as INACTIVE and sets state to STOPPED.
   */
  async completeShutdown(): Promise<void> {
    this.state = "STOPPED";
    this.uninstallSignalHandlers();

    if (this.workerRecord) {
      try {
        await this.workerRepo.deactivate(
          this.config.tenantId,
          this.workerRecord.id
        );
      } catch (error) {
        // Best effort deactivate during shutdown
        console.error(
          `Failed to deactivate worker "${this.workerRecord.id}":`,
          error
        );
      }
    }
  }

  private installSignalHandlers(): void {
    if (typeof process !== "undefined" && process.on) {
      process.on("SIGTERM", this.boundSignalHandler);
      process.on("SIGINT", this.boundSignalHandler);
      this.signalHandlersInstalled = true;
    }
  }

  private uninstallSignalHandlers(): void {
    if (this.signalHandlersInstalled && typeof process !== "undefined" && process.removeListener) {
      process.removeListener("SIGTERM", this.boundSignalHandler);
      process.removeListener("SIGINT", this.boundSignalHandler);
      this.signalHandlersInstalled = false;
    }
  }
}
