import { Worker } from "./worker";
import type { WorkerOptions } from "./types";

export class WorkerManager {
  private readonly workers = new Map<string, Worker>();

  /**
   * Creates, registers, and tracks a new Worker instance.
   */
  createWorker(options: WorkerOptions & { ownsClient?: boolean }): Worker {
    const worker = new Worker(options);
    this.addWorker(worker);
    return worker;
  }

  /**
   * Adds an existing Worker instance to management.
   */
  addWorker(worker: Worker): void {
    this.workers.set(worker.id, worker);
  }

  /**
   * Returns a specific worker by ID.
   */
  getWorker(workerId: string): Worker | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Returns all managed worker instances.
   */
  getWorkers(): readonly Worker[] {
    return Array.from(this.workers.values());
  }

  /**
   * Total number of currently active jobs across all managed workers.
   */
  getActiveJobCount(): number {
    let total = 0;
    for (const worker of this.workers.values()) {
      total += worker.getActiveJobCount();
    }
    return total;
  }

  /**
   * Starts all managed workers concurrently.
   */
  async startAll(): Promise<void> {
    const startPromises = Array.from(this.workers.values()).map((w) =>
      w.start()
    );
    await Promise.all(startPromises);
  }

  /**
   * Pauses all managed workers.
   */
  pauseAll(): void {
    for (const worker of this.workers.values()) {
      worker.pause();
    }
  }

  /**
   * Resumes all managed workers.
   */
  resumeAll(): void {
    for (const worker of this.workers.values()) {
      worker.resume();
    }
  }

  /**
   * Gracefully stops all managed workers concurrently.
   */
  async stopAll(options?: { gracePeriodMs?: number }): Promise<void> {
    const stopPromises = Array.from(this.workers.values()).map((w) =>
      w.stop(options)
    );
    await Promise.all(stopPromises);
  }

  /**
   * Removes a worker from management.
   */
  removeWorker(workerId: string): boolean {
    return this.workers.delete(workerId);
  }

  /**
   * Clears all workers from management.
   */
  clear(): void {
    this.workers.clear();
  }
}
