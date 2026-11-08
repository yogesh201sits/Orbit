import { describe, test, expect, mock } from "bun:test";
import { WorkerLifecycle } from "../src/lifecycle/worker-lifecycle";
import type { IWorkerRepository, WorkerRecord } from "@durable/storage";
import type { WorkerConfig } from "../src/types";

describe("WorkerLifecycle", () => {
  const dummyConfig: WorkerConfig = {
    tenantId: "t-1",
    workerId: "w-1",
    name: "worker-1",
    queues: ["default", "critical"],
    concurrency: 3,
    pollIntervalMs: 500,
    leaseDurationMs: 15000,
    heartbeatIntervalMs: 5000,
    shutdownGracePeriodMs: 2000,
    staleWorkerTimeoutMs: 30000,
    autoRecoverLeases: true,
    recoveryIntervalMs: 10000,
    handleSignals: false,
    metadata: { env: "test" },
  };

  test("initializes with INITIALIZING state", () => {
    const mockRepo: IWorkerRepository = {
      create: mock(async () => ({} as WorkerRecord)),
      findById: mock(async () => null),
      heartbeat: mock(async () => ({} as WorkerRecord)),
      deactivate: mock(async () => ({} as WorkerRecord)),
      listActive: mock(async () => []),
    };

    const lifecycle = new WorkerLifecycle(mockRepo, dummyConfig);
    expect(lifecycle.getState()).toBe("INITIALIZING");
    expect(lifecycle.canClaimJobs()).toBe(false);
  });

  test("registers worker and transitions to RUNNING", async () => {
    const registeredRecord: WorkerRecord = {
      id: "w-record-1",
      tenantId: "t-1",
      name: "worker-1",
      queues: ["default", "critical"],
      status: "ACTIVE",
      lastHeartbeat: new Date(),
      metadata: { env: "test" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockRepo: IWorkerRepository = {
      create: mock(async () => registeredRecord),
      findById: mock(async () => registeredRecord),
      heartbeat: mock(async () => registeredRecord),
      deactivate: mock(async () => registeredRecord),
      listActive: mock(async () => [registeredRecord]),
    };

    const lifecycle = new WorkerLifecycle(mockRepo, dummyConfig);
    const result = await lifecycle.registerAndStart();

    expect(result.id).toBe("w-record-1");
    expect(lifecycle.getState()).toBe("RUNNING");
    expect(lifecycle.isRunning()).toBe(true);
    expect(lifecycle.canClaimJobs()).toBe(true);
    expect(mockRepo.create).toHaveBeenCalledTimes(1);
  });

  test("supports pause and resume", async () => {
    const mockRepo: IWorkerRepository = {
      create: mock(async () => ({ id: "w-1" } as WorkerRecord)),
      findById: mock(async () => null),
      heartbeat: mock(async () => ({ id: "w-1" } as WorkerRecord)),
      deactivate: mock(async () => ({ id: "w-1" } as WorkerRecord)),
      listActive: mock(async () => []),
    };

    const lifecycle = new WorkerLifecycle(mockRepo, dummyConfig);
    await lifecycle.registerAndStart();

    lifecycle.pause();
    expect(lifecycle.getState()).toBe("PAUSED");
    expect(lifecycle.isPaused()).toBe(true);
    expect(lifecycle.canClaimJobs()).toBe(false);

    lifecycle.resume();
    expect(lifecycle.getState()).toBe("RUNNING");
    expect(lifecycle.isRunning()).toBe(true);
    expect(lifecycle.canClaimJobs()).toBe(true);
  });

  test("supports shutdown and worker deactivation", async () => {
    let deactivated = false;
    const mockRepo: IWorkerRepository = {
      create: mock(async () => ({ id: "w-1", tenantId: "t-1" } as WorkerRecord)),
      findById: mock(async () => null),
      heartbeat: mock(async () => ({} as WorkerRecord)),
      deactivate: mock(async () => {
        deactivated = true;
        return {} as WorkerRecord;
      }),
      listActive: mock(async () => []),
    };

    const lifecycle = new WorkerLifecycle(mockRepo, dummyConfig);
    await lifecycle.registerAndStart();

    lifecycle.beginStopping();
    expect(lifecycle.getState()).toBe("STOPPING");
    expect(lifecycle.canClaimJobs()).toBe(false);

    await lifecycle.completeShutdown();
    expect(lifecycle.getState()).toBe("STOPPED");
    expect(lifecycle.isStopped()).toBe(true);
    expect(deactivated).toBe(true);
  });
});
