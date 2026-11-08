import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import {
  createClient,
  disconnect,
  PrismaTenantRepository,
  PrismaJobRepository,
  PrismaWorkerRepository,
  type PrismaClient,
} from "@durable/storage";
import { LeaseManager } from "../src/leases/lease-manager";
import { LeaseLostError } from "../src/errors/worker-errors";

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

describe("LeaseManager Integration Tests", () => {
  test("acquires lease and renews atomically in PostgreSQL", async () => {
    const tenant = await tenants.create({
      name: "Lease Test",
      slug: `lease-${Date.now()}`,
    });

    const workerRecord = await workers.create({
      tenantId: tenant.id,
      name: "worker-1",
      queues: ["default"],
    });

    const createdJob = await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "test.job",
      payload: { hello: "world" },
    });

    // Worker dequeues job with 10s lease
    const claimedJob = await jobs.dequeue(
      tenant.id,
      ["default"],
      workerRecord.id,
      10_000
    );
    expect(claimedJob).not.toBeNull();
    expect(claimedJob!.leaseOwner).toBe(workerRecord.id);

    const leaseManager = new LeaseManager({
      client,
      workerId: workerRecord.id,
      defaultLeaseDurationMs: 10_000,
    });

    const lease = leaseManager.acquire(claimedJob!);
    expect(leaseManager.getActiveCount()).toBe(1);
    expect(lease.abortController.signal.aborted).toBe(false);

    // Initial expires at
    const initialExpiry = claimedJob!.leaseExpiresAt!.getTime();

    // Small delay to ensure timestamp progression
    await new Promise((r) => setTimeout(r, 100));

    // Renew lease for 20s
    const renewed = await leaseManager.renewLease(claimedJob!.id, 20_000);
    expect(renewed).toBe(true);

    const updatedJob = await jobs.findById(tenant.id, claimedJob!.id);
    expect(updatedJob!.leaseExpiresAt!.getTime()).toBeGreaterThan(initialExpiry);
    expect(leaseManager.getLease(claimedJob!.id)!.leaseExpiresAt.getTime()).toBeGreaterThan(
      initialExpiry
    );

    // Fencing token validation
    const isValid = await leaseManager.validateFencingToken(
      claimedJob!.id,
      claimedJob!.fencingToken
    );
    expect(isValid).toBe(true);
  });

  test("detects lease loss and triggers abort signal when fencing token or ownership changes", async () => {
    const tenant = await tenants.create({
      name: "Lease Loss Test",
      slug: `lease-loss-${Date.now()}`,
    });

    const worker1 = await workers.create({
      tenantId: tenant.id,
      name: "worker-1",
      queues: ["default"],
    });

    await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "test.job",
      payload: { foo: "bar" },
    });

    const claimedJob = await jobs.dequeue(
      tenant.id,
      ["default"],
      worker1.id,
      10_000
    );
    expect(claimedJob).not.toBeNull();

    const leaseManager = new LeaseManager({
      client,
      workerId: worker1.id,
    });

    const lease = leaseManager.acquire(claimedJob!);

    // Simulate recovery or another process stealing the job / bumping fencing token:
    // Update fencing token directly in DB
    await client.$executeRaw`
      UPDATE jobs
      SET fencing_token = fencing_token + 1
      WHERE id = ${claimedJob!.id}::uuid
    `;

    // Attempting to renew lease should fail
    const renewed = await leaseManager.renewLease(claimedJob!.id, 20_000);
    expect(renewed).toBe(false);

    // Lease should be removed and abort signal triggered
    expect(leaseManager.getActiveCount()).toBe(0);
    expect(lease.abortController.signal.aborted).toBe(true);
    expect(lease.abortController.signal.reason).toBeInstanceOf(LeaseLostError);

    // Fencing token validation should return false
    const isValid = await leaseManager.validateFencingToken(
      claimedJob!.id,
      claimedJob!.fencingToken
    );
    expect(isValid).toBe(false);
  });

  test("expiration detection detects local wall-clock expiration", async () => {
    const tenant = await tenants.create({
      name: "Expiry Test",
      slug: `expiry-${Date.now()}`,
    });

    const workerRecord = await workers.create({
      tenantId: tenant.id,
      name: "worker-1",
      queues: ["default"],
    });

    const claimedJob = await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "test.job",
      payload: {},
    });

    const leaseManager = new LeaseManager({
      client,
      workerId: workerRecord.id,
    });

    // Acquire with lease that expired 1 second ago
    const lease = leaseManager.acquire({
      ...claimedJob,
      status: "RUNNING",
      leaseOwner: workerRecord.id,
      leaseExpiresAt: new Date(Date.now() - 1000),
      fencingToken: 1n,
      claimedAt: new Date(),
    });

    expect(lease.abortController.signal.aborted).toBe(false);

    const expired = leaseManager.checkExpiration(new Date());
    expect(expired).toContain(claimedJob.id);
    expect(lease.abortController.signal.aborted).toBe(true);
    expect(lease.abortController.signal.reason).toBeInstanceOf(LeaseLostError);
    expect(leaseManager.getActiveCount()).toBe(0);
  });
});
