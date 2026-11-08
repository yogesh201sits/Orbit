import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import {
  createClient,
  disconnect,
  PrismaTenantRepository,
  PrismaJobRepository,
  PrismaWorkerRepository,
  ConflictError,
  type PrismaClient,
} from "@durable/storage";
import { RecoveryCoordinator } from "../src/recovery/recovery-coordinator";

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:1234@localhost:5432/orbit_test?schema=public";

let client: PrismaClient;
let tenants: PrismaTenantRepository;
let jobs: PrismaJobRepository;
let workers: PrismaWorkerRepository;

beforeAll(async () => {
  client = createClient(DATABASE_URL);
  tenants = new PrismaTenantRepository(client);
  jobs = new PrismaJobRepository(client);
  workers = new PrismaWorkerRepository(client);
});

afterAll(async () => {
  await disconnect(client);
});

beforeEach(async () => {
  await client.workflowSchedule.deleteMany();
  await client.outboxEvent.deleteMany();
  await client.workflowEvent.deleteMany();
  await client.workflowStep.deleteMany();
  await client.workflowRun.deleteMany();
  await client.workflowVersion.deleteMany();
  await client.workflow.deleteMany();
  await client.job.deleteMany();
  await client.worker.deleteMany();
  await client.tenant.deleteMany();
});

describe("RecoveryCoordinator PostgreSQL Integration Tests", () => {
  test("recovers expired job leases and increments fencing token", async () => {
    const tenant = await tenants.create({
      name: "Recovery Tenant",
      slug: `rec-${Date.now()}`,
    });

    const worker = await workers.create({
      tenantId: tenant.id,
      name: "worker-1",
      queues: ["default"],
    });

    const job = await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "order.process",
      payload: {},
      maxRetries: 3,
    });

    const claimed = await jobs.dequeue(tenant.id, ["default"], worker.id, 10_000);
    expect(claimed).not.toBeNull();
    const originalFencingToken = claimed!.fencingToken;

    // Simulate lease expiry in DB
    await client.$executeRaw`
      UPDATE jobs
      SET lease_expires_at = NOW() - INTERVAL '10 seconds'
      WHERE id = ${claimed!.id}::uuid
    `;

    const recovery = new RecoveryCoordinator({
      client,
      jobRepo: jobs,
      workerRepo: workers,
      tenantId: tenant.id,
    });

    const recoveredCount = await recovery.recoverExpiredJobLeases();
    expect(recoveredCount).toBe(1);

    const recoveredJob = await jobs.findById(tenant.id, claimed!.id);
    expect(recoveredJob?.status).toBe("PENDING");
    expect(recoveredJob?.retryCount).toBe(1);
    expect(recoveredJob?.leaseOwner).toBeNull();
    expect(recoveredJob?.fencingToken).toBeGreaterThan(originalFencingToken);
  });

  test("marks job as FAILED when maxRetries is reached upon lease expiry", async () => {
    const tenant = await tenants.create({
      name: "Max Retries Tenant",
      slug: `max-retries-${Date.now()}`,
    });

    const worker = await workers.create({
      tenantId: tenant.id,
      name: "worker-1",
      queues: ["default"],
    });

    // maxRetries = 1, initial retryCount = 0
    const job = await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "fragile.job",
      payload: {},
      maxRetries: 1,
    });

    const claimed = await jobs.dequeue(tenant.id, ["default"], worker.id, 5000);

    // Force expire lease
    await client.$executeRaw`
      UPDATE jobs
      SET lease_expires_at = NOW() - INTERVAL '5 seconds'
      WHERE id = ${claimed!.id}::uuid
    `;

    const recovery = new RecoveryCoordinator({
      client,
      jobRepo: jobs,
      workerRepo: workers,
      tenantId: tenant.id,
    });

    const recoveredCount = await recovery.recoverExpiredJobLeases();
    expect(recoveredCount).toBe(1);

    const failedJob = await jobs.findById(tenant.id, claimed!.id);
    expect(failedJob?.status).toBe("FAILED");
    expect(failedJob?.completedAt).toBeInstanceOf(Date);
  });

  test("worker crash simulation: reclaims job for competing worker and fences out crashed worker", async () => {
    const tenant = await tenants.create({
      name: "Crash Simulation Tenant",
      slug: `crash-${Date.now()}`,
    });

    const crashedWorker = await workers.create({
      tenantId: tenant.id,
      name: "worker-crashed",
      queues: ["default"],
    });

    const aliveWorker = await workers.create({
      tenantId: tenant.id,
      name: "worker-alive",
      queues: ["default"],
    });

    const job = await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "critical.job",
      payload: { data: 42 },
      maxRetries: 3,
    });

    // 1. Crashed worker claims the job
    const claim1 = await jobs.dequeue(tenant.id, ["default"], crashedWorker.id, 30_000);
    expect(claim1).not.toBeNull();
    const staleFencingToken = claim1!.fencingToken;

    // 2. Recovery coordinator detects worker crash
    const recovery = new RecoveryCoordinator({
      client,
      jobRepo: jobs,
      workerRepo: workers,
      tenantId: tenant.id,
    });

    await recovery.recoverCrashedWorker(crashedWorker.id);

    // Verify crashed worker is now INACTIVE
    const workerStatus = await workers.findById(tenant.id, crashedWorker.id);
    expect(workerStatus?.status).toBe("INACTIVE");

    // 3. Alive worker claims the recovered job
    const claim2 = await jobs.dequeue(tenant.id, ["default"], aliveWorker.id, 30_000);
    expect(claim2).not.toBeNull();
    expect(claim2!.id).toBe(job.id);
    expect(claim2!.leaseOwner).toBe(aliveWorker.id);
    expect(claim2!.fencingToken).toBeGreaterThan(staleFencingToken);

    // 4. Stale/crashed worker wakes up and tries to commit: MUST BE REJECTED!
    let rejectedWithConflict = false;
    try {
      await jobs.update(tenant.id, job.id, {
        status: "COMPLETED",
        completedAt: new Date(),
        expectedFencingToken: staleFencingToken,
      });
    } catch (err) {
      if (err instanceof ConflictError) {
        rejectedWithConflict = true;
      } else {
        throw err;
      }
    }
    expect(rejectedWithConflict).toBe(true);

    // 5. Alive worker successfully commits completion
    const completedJob = await jobs.update(tenant.id, job.id, {
      status: "COMPLETED",
      completedAt: new Date(),
      expectedFencingToken: claim2!.fencingToken,
    });

    expect(completedJob.status).toBe("COMPLETED");
  });

  test("deactivates stale worker records whose heartbeat timed out", async () => {
    const tenant = await tenants.create({
      name: "Stale Worker Test",
      slug: `stale-${Date.now()}`,
    });

    const staleWorker = await workers.create({
      tenantId: tenant.id,
      name: "stale-worker",
      queues: ["default"],
    });

    // Set last heartbeat to 10 minutes ago
    await client.worker.update({
      where: { id: staleWorker.id },
      data: { lastHeartbeat: new Date(Date.now() - 600_000) },
    });

    const activeWorker = await workers.create({
      tenantId: tenant.id,
      name: "active-worker",
      queues: ["default"],
    });

    const recovery = new RecoveryCoordinator({
      client,
      jobRepo: jobs,
      workerRepo: workers,
      tenantId: tenant.id,
      staleWorkerTimeoutMs: 60_000,
    });

    const count = await recovery.deactivateStaleWorkers();
    expect(count).toBe(1);

    const staleCheck = await workers.findById(tenant.id, staleWorker.id);
    const activeCheck = await workers.findById(tenant.id, activeWorker.id);

    expect(staleCheck?.status).toBe("INACTIVE");
    expect(activeCheck?.status).toBe("ACTIVE");
  });
});
