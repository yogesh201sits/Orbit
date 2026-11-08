import { describe, test, expect, mock } from "bun:test";
import { HeartbeatCoordinator } from "../src/heartbeat/heartbeat-coordinator";
import { LeaseManager } from "../src/leases/lease-manager";
import type { IWorkerRepository, WorkerRecord, PrismaClient } from "@durable/storage";
import { DatabaseHeartbeatError } from "../src/errors/worker-errors";

describe("HeartbeatCoordinator", () => {
  const dummyWorkerId = "w-123";
  const dummyTenantId = "t-456";

  test("successfully heartbeats worker and renews leases", async () => {
    let workerHeartbeated = false;
    const mockWorkerRepo: IWorkerRepository = {
      create: mock(async () => ({} as WorkerRecord)),
      findById: mock(async () => null),
      heartbeat: mock(async (tenantId, id) => {
        workerHeartbeated = true;
        return { id, tenantId } as WorkerRecord;
      }),
      deactivate: mock(async () => ({} as WorkerRecord)),
      listActive: mock(async () => []),
    };

    const mockClient = {
      $executeRaw: mock(async () => 1),
      $queryRaw: mock(async () => []),
    } as unknown as PrismaClient;

    const leaseManager = new LeaseManager({
      client: mockClient,
      workerId: dummyWorkerId,
    });

    const coordinator = new HeartbeatCoordinator({
      workerRepo: mockWorkerRepo,
      leaseManager,
      tenantId: dummyTenantId,
      workerId: dummyWorkerId,
    });

    const result = await coordinator.tick();
    expect(result.workerHeartbeatSuccess).toBe(true);
    expect(result.consecutiveFailures).toBe(0);
    expect(result.skippedDueToOverlap).toBe(false);
    expect(workerHeartbeated).toBe(true);
  });

  test("skips execution when heartbeat operations overlap", async () => {
    let resolveSlowHeartbeat!: () => void;
    const slowPromise = new Promise<WorkerRecord>((res) => {
      resolveSlowHeartbeat = () => res({} as WorkerRecord);
    });

    const mockWorkerRepo: IWorkerRepository = {
      create: mock(async () => ({} as WorkerRecord)),
      findById: mock(async () => null),
      heartbeat: mock(async () => slowPromise),
      deactivate: mock(async () => ({} as WorkerRecord)),
      listActive: mock(async () => []),
    };

    const leaseManager = new LeaseManager({
      client: {} as PrismaClient,
      workerId: dummyWorkerId,
    });

    const coordinator = new HeartbeatCoordinator({
      workerRepo: mockWorkerRepo,
      leaseManager,
      tenantId: dummyTenantId,
      workerId: dummyWorkerId,
    });

    // Launch first tick (which hangs on slowPromise)
    const tick1 = coordinator.tick();

    // Immediately trigger second tick
    const tick2Result = await coordinator.tick();
    expect(tick2Result.skippedDueToOverlap).toBe(true);
    expect(tick2Result.workerHeartbeatSuccess).toBe(false);

    // Complete the first tick
    resolveSlowHeartbeat();
    const tick1Result = await tick1;
    expect(tick1Result.workerHeartbeatSuccess).toBe(true);
  });

  test("tracks database failure and aborts jobs after max consecutive failures", async () => {
    let failureCountRecorded = 0;
    const mockWorkerRepo: IWorkerRepository = {
      create: mock(async () => ({} as WorkerRecord)),
      findById: mock(async () => null),
      heartbeat: mock(async () => {
        throw new Error("PostgreSQL connection lost");
      }),
      deactivate: mock(async () => ({} as WorkerRecord)),
      listActive: mock(async () => []),
    };

    const leaseManager = new LeaseManager({
      client: {} as PrismaClient,
      workerId: dummyWorkerId,
    });

    // Acquire a mock lease to observe abort
    const lease = leaseManager.acquire({
      id: "j-1",
      tenantId: dummyTenantId,
      queue: "default",
      type: "task",
      payload: {},
      status: "RUNNING",
      priority: 0,
      maxRetries: 3,
      retryCount: 0,
      scheduledAt: new Date(),
      startedAt: new Date(),
      completedAt: null,
      error: null,
      leaseOwner: dummyWorkerId,
      leaseExpiresAt: new Date(Date.now() + 60_000),
      fencingToken: 1n,
      claimedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const coordinator = new HeartbeatCoordinator({
      workerRepo: mockWorkerRepo,
      leaseManager,
      tenantId: dummyTenantId,
      workerId: dummyWorkerId,
      maxConsecutiveFailures: 3,
      onDatabaseFailure: (_err, count) => {
        failureCountRecorded = count;
      },
    });

    // Failure 1
    const res1 = await coordinator.tick();
    expect(res1.workerHeartbeatSuccess).toBe(false);
    expect(res1.consecutiveFailures).toBe(1);
    expect(failureCountRecorded).toBe(1);
    expect(lease.abortController.signal.aborted).toBe(false);

    // Failure 2
    const res2 = await coordinator.tick();
    expect(res2.consecutiveFailures).toBe(2);
    expect(lease.abortController.signal.aborted).toBe(false);

    // Failure 3 -> should abort active leases
    const res3 = await coordinator.tick();
    expect(res3.consecutiveFailures).toBe(3);
    expect(lease.abortController.signal.aborted).toBe(true);
    expect(lease.abortController.signal.reason).toBeInstanceOf(DatabaseHeartbeatError);
    expect(leaseManager.getActiveCount()).toBe(0);
  });
});
