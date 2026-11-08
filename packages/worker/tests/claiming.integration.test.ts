import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import {
  createClient,
  disconnect,
  PrismaTenantRepository,
  PrismaJobRepository,
  PrismaWorkerRepository,
  type PrismaClient,
} from "@durable/storage";
import { JobClaimer } from "../src/claiming/job-claimer";

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

describe("JobClaimer PostgreSQL Integration Tests", () => {
  test("claims jobs respecting priority ordering", async () => {
    const tenant = await tenants.create({
      name: "Priority Test",
      slug: `prio-${Date.now()}`,
    });

    const worker = await workers.create({
      tenantId: tenant.id,
      name: "worker-1",
      queues: ["default"],
    });

    // Create low, high, medium priority jobs
    const jLow = await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "low",
      payload: {},
      priority: 0,
    });
    const jHigh = await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "high",
      payload: {},
      priority: 10,
    });
    const jMed = await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "med",
      payload: {},
      priority: 5,
    });

    const claimer = new JobClaimer({
      jobRepo: jobs,
      tenantId: tenant.id,
      workerId: worker.id,
      queues: ["default"],
      concurrency: 5,
      getActiveCount: () => 0,
      canClaim: () => true,
    });

    const c1 = await claimer.claimNext();
    const c2 = await claimer.claimNext();
    const c3 = await claimer.claimNext();

    expect(c1?.id).toBe(jHigh.id);
    expect(c2?.id).toBe(jMed.id);
    expect(c3?.id).toBe(jLow.id);
  });

  test("filters jobs strictly by assigned queues", async () => {
    const tenant = await tenants.create({
      name: "Queue Filter Test",
      slug: `q-filter-${Date.now()}`,
    });

    const worker = await workers.create({
      tenantId: tenant.id,
      name: "email-worker",
      queues: ["emails"],
    });

    // Create job in "reports" queue and job in "emails" queue
    await jobs.create({
      tenantId: tenant.id,
      queue: "reports",
      type: "report.gen",
      payload: {},
    });
    const emailJob = await jobs.create({
      tenantId: tenant.id,
      queue: "emails",
      type: "email.send",
      payload: {},
    });

    const claimer = new JobClaimer({
      jobRepo: jobs,
      tenantId: tenant.id,
      workerId: worker.id,
      queues: ["emails"],
      concurrency: 5,
      getActiveCount: () => 0,
      canClaim: () => true,
    });

    const claimed = await claimer.claimNext();
    expect(claimed?.id).toBe(emailJob.id);

    // Second claim should be null because reports queue is ignored
    const second = await claimer.claimNext();
    expect(second).toBeNull();
  });

  test("respects scheduled execution time (scheduledAt in future)", async () => {
    const tenant = await tenants.create({
      name: "Scheduled Test",
      slug: `sched-${Date.now()}`,
    });

    const worker = await workers.create({
      tenantId: tenant.id,
      name: "worker-1",
      queues: ["default"],
    });

    // Future job scheduled 24 hours in the future
    await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "future.job",
      payload: {},
      scheduledAt: new Date(Date.now() + 24 * 3600_000),
    });

    // Due job
    const dueJob = await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "due.job",
      payload: {},
      scheduledAt: new Date(Date.now() - 1000),
    });

    const claimer = new JobClaimer({
      jobRepo: jobs,
      tenantId: tenant.id,
      workerId: worker.id,
      queues: ["default"],
      concurrency: 5,
      getActiveCount: () => 0,
      canClaim: () => true,
    });

    const c1 = await claimer.claimNext();
    expect(c1?.id).toBe(dueJob.id);

    const c2 = await claimer.claimNext();
    expect(c2).toBeNull();
  });

  test("enforces concurrency limits and capacity gating", async () => {
    const tenant = await tenants.create({
      name: "Capacity Test",
      slug: `cap-${Date.now()}`,
    });

    const worker = await workers.create({
      tenantId: tenant.id,
      name: "worker-1",
      queues: ["default"],
    });

    await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "j1",
      payload: {},
    });
    await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "j2",
      payload: {},
    });

    let activeCount = 2; // Simulating at capacity (concurrency = 2)
    const claimer = new JobClaimer({
      jobRepo: jobs,
      tenantId: tenant.id,
      workerId: worker.id,
      queues: ["default"],
      concurrency: 2,
      getActiveCount: () => activeCount,
      canClaim: () => true,
    });

    expect(claimer.getAvailableCapacity()).toBe(0);
    const noClaim = await claimer.claimNext();
    expect(noClaim).toBeNull();

    // Capacity frees up
    activeCount = 1;
    expect(claimer.getAvailableCapacity()).toBe(1);
    const claimed = await claimer.claimNext();
    expect(claimed).not.toBeNull();
  });

  test("concurrent claiming: multiple workers competing never claim the same job (FOR UPDATE SKIP LOCKED)", async () => {
    const tenant = await tenants.create({
      name: "Concurrent Workers Test",
      slug: `concurrent-${Date.now()}`,
    });

    // Create 3 active workers
    const w1 = await workers.create({ tenantId: tenant.id, name: "w1", queues: ["default"] });
    const w2 = await workers.create({ tenantId: tenant.id, name: "w2", queues: ["default"] });
    const w3 = await workers.create({ tenantId: tenant.id, name: "w3", queues: ["default"] });

    // Create 15 jobs in the queue
    const createdJobIds = new Set<string>();
    for (let i = 0; i < 15; i++) {
      const job = await jobs.create({
        tenantId: tenant.id,
        queue: "default",
        type: `job-${i}`,
        payload: { i },
      });
      createdJobIds.add(job.id);
    }

    const c1 = new JobClaimer({
      jobRepo: jobs,
      tenantId: tenant.id,
      workerId: w1.id,
      queues: ["default"],
      concurrency: 10,
      getActiveCount: () => 0,
      canClaim: () => true,
    });
    const c2 = new JobClaimer({
      jobRepo: jobs,
      tenantId: tenant.id,
      workerId: w2.id,
      queues: ["default"],
      concurrency: 10,
      getActiveCount: () => 0,
      canClaim: () => true,
    });
    const c3 = new JobClaimer({
      jobRepo: jobs,
      tenantId: tenant.id,
      workerId: w3.id,
      queues: ["default"],
      concurrency: 10,
      getActiveCount: () => 0,
      canClaim: () => true,
    });

    // Run parallel claim loops across all 3 workers
    const claimedByAll: string[] = [];
    const claimWorker = async (claimer: JobClaimer) => {
      while (true) {
        const j = await claimer.claimNext();
        if (!j) break;
        claimedByAll.push(j.id);
      }
    };

    await Promise.all([claimWorker(c1), claimWorker(c2), claimWorker(c3)]);

    // Exactly 15 jobs should have been claimed
    expect(claimedByAll.length).toBe(15);

    // Each job must have been claimed EXACTLY ONCE (no duplicates)
    const uniqueClaimed = new Set(claimedByAll);
    expect(uniqueClaimed.size).toBe(15);

    // All created jobs were claimed
    for (const id of createdJobIds) {
      expect(uniqueClaimed.has(id)).toBe(true);
    }
  });
});
