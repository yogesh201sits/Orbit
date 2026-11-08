import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import {
  createClient,
  disconnect,
  PrismaTenantRepository,
  PrismaWorkflowRepository,
  PrismaWorkflowVersionRepository,
  PrismaWorkflowRunRepository,
  PrismaWorkflowStepRepository,
  PrismaWorkflowEventRepository,
  PrismaJobRepository,
  PrismaWorkerRepository,
  type PrismaClient,
} from "@durable/storage";
import { defineWorkflow } from "@durable/engine";
import { Worker } from "../src/worker";
import { WorkerManager } from "../src/worker-manager";

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:1234@localhost:5432/orbit_test?schema=public";

let client: PrismaClient;
let tenants: PrismaTenantRepository;
let workflows: PrismaWorkflowRepository;
let versions: PrismaWorkflowVersionRepository;
let runs: PrismaWorkflowRunRepository;
let steps: PrismaWorkflowStepRepository;
let events: PrismaWorkflowEventRepository;
let jobs: PrismaJobRepository;
let workers: PrismaWorkerRepository;

const activeWorkers: Worker[] = [];

beforeAll(async () => {
  client = createClient(DATABASE_URL);
  tenants = new PrismaTenantRepository(client);
  workflows = new PrismaWorkflowRepository(client);
  versions = new PrismaWorkflowVersionRepository(client);
  runs = new PrismaWorkflowRunRepository(client);
  steps = new PrismaWorkflowStepRepository(client);
  events = new PrismaWorkflowEventRepository(client);
  jobs = new PrismaJobRepository(client);
  workers = new PrismaWorkerRepository(client);
});

afterAll(async () => {
  for (const w of activeWorkers) {
    try {
      await w.stop();
    } catch {}
  }
  await disconnect(client);
});

afterEach(async () => {
  for (const w of activeWorkers) {
    try {
      await w.stop();
    } catch {}
  }
  activeWorkers.length = 0;
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

describe("Worker End-to-End Integration Tests", () => {
  test("1 & 2: Worker registration, startup, and status persistence", async () => {
    const tenant = await tenants.create({
      name: "Lifecycle Corp",
      slug: `lifecycle-${Date.now()}`,
    });

    const worker = new Worker({
      client,
      workerRepo: workers,
      jobRepo: jobs,
      tenantId: tenant.id,
      name: "primary-worker",
      queues: ["default", "critical"],
      concurrency: 4,
      autoRecoverLeases: false,
      autoStartPolling: false,
    });
    activeWorkers.push(worker);

    expect(worker.getState()).toBe("INITIALIZING");

    const record = await worker.start();
    expect(worker.getState()).toBe("RUNNING");
    expect(record.status).toBe("ACTIVE");
    expect(record.name).toBe("primary-worker");
    expect(record.queues).toEqual(["default", "critical"]);

    // Verify persisted in PostgreSQL
    const dbRecord = await workers.findById(tenant.id, worker.id);
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.status).toBe("ACTIVE");

    await worker.stop();
    expect(worker.getState()).toBe("STOPPED");

    // Verify worker status in PostgreSQL transitioned to INACTIVE
    const stoppedRecord = await workers.findById(tenant.id, worker.id);
    expect(stoppedRecord?.status).toBe("INACTIVE");
  });

  test("pause and resume controls job claiming", async () => {
    const tenant = await tenants.create({
      name: "Pause Corp",
      slug: `pause-${Date.now()}`,
    });

    const worker = new Worker({
      client,
      workerRepo: workers,
      jobRepo: jobs,
      tenantId: tenant.id,
      autoRecoverLeases: false,
      autoStartPolling: false,
    });
    activeWorkers.push(worker);

    await worker.start();

    // Create a job in queue
    await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "task",
      payload: {},
    });

    // Pause worker
    worker.pause();
    expect(worker.getState()).toBe("PAUSED");

    // Attempting to tick while paused claims 0 jobs
    const claimedWhilePaused = await worker.tick();
    expect(claimedWhilePaused).toBe(0);

    // Resume worker
    worker.resume();
    expect(worker.getState()).toBe("RUNNING");

    // Now tick claims the job
    const claimed = await worker.tick();
    expect(claimed).toBe(1);

    await worker.stop();
  });

  test("11: Graceful shutdown allows active jobs grace period and aborts unfinished ones", async () => {
    const tenant = await tenants.create({
      name: "Graceful Shutdown Corp",
      slug: `shutdown-${Date.now()}`,
    });

    const worker = new Worker({
      client,
      workerRepo: workers,
      jobRepo: jobs,
      tenantId: tenant.id,
      shutdownGracePeriodMs: 200, // Short grace period for fast testing
      autoRecoverLeases: false,
      autoStartPolling: false,
    });
    activeWorkers.push(worker);

    let job1Completed = false;
    let job2Aborted = false;

    // Fast job that finishes in 50ms (within grace period)
    worker.registerHandler("fast.job", async () => {
      await new Promise((r) => setTimeout(r, 50));
      job1Completed = true;
      return { ok: true };
    });

    // Slow job that runs for 2000ms (exceeds grace period)
    worker.registerHandler("slow.job", async (_j, signal) => {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 2000);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          job2Aborted = true;
          reject(signal.reason);
        });
      });
    });

    await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "fast.job",
      payload: {},
    });
    await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "slow.job",
      payload: {},
    });

    await worker.start();

    // Claim both jobs
    await worker.tick();
    expect(worker.getActiveJobCount()).toBe(2);

    // Trigger graceful stop with 150ms grace period
    await worker.stop({ gracePeriodMs: 150 });

    expect(worker.getState()).toBe("STOPPED");
    expect(job1Completed).toBe(true);
    expect(job2Aborted).toBe(true);
    expect(worker.getActiveJobCount()).toBe(0);

    // Verify worker in DB is INACTIVE
    const dbWorker = await workers.findById(tenant.id, worker.id);
    expect(dbWorker?.status).toBe("INACTIVE");
  });

  test("12: Multiple workers competing for jobs via WorkerManager", async () => {
    const tenant = await tenants.create({
      name: "Cluster Corp",
      slug: `cluster-${Date.now()}`,
    });

    const manager = new WorkerManager();
    const processedBy = new Map<string, string>(); // jobId -> workerId

    // Create 3 workers
    for (let i = 1; i <= 3; i++) {
      const w = manager.createWorker({
        client,
        workerRepo: workers,
        jobRepo: jobs,
        tenantId: tenant.id,
        name: `worker-node-${i}`,
        concurrency: 5,
        pollIntervalMs: 50,
        autoRecoverLeases: false,
      });
      activeWorkers.push(w);

      w.registerHandler("cluster.task", async (job) => {
        processedBy.set(job.id, w.id);
        return { doneBy: w.id };
      });
    }

    // Create 12 jobs in queue
    const createdIds: string[] = [];
    for (let i = 0; i < 12; i++) {
      const j = await jobs.create({
        tenantId: tenant.id,
        queue: "default",
        type: "cluster.task",
        payload: { index: i },
      });
      createdIds.push(j.id);
    }

    // Start all workers
    await manager.startAll();

    // Give workers time to poll and process all 12 jobs
    const start = Date.now();
    let allCompleted = false;
    while (!allCompleted && Date.now() - start < 5000) {
      let count = 0;
      for (const id of createdIds) {
        const record = await jobs.findById(tenant.id, id);
        if (record?.status === "COMPLETED") {
          count++;
        }
      }
      if (count === 12) {
        allCompleted = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(allCompleted).toBe(true);
    expect(processedBy.size).toBe(12);

    // Verify distinct workers participated
    const participatingWorkers = new Set(processedBy.values());
    expect(participatingWorkers.size).toBeGreaterThan(1);

    // Stop all workers
    await manager.stopAll();

    for (const w of manager.getWorkers()) {
      expect(w.getState()).toBe("STOPPED");
      const dbW = await workers.findById(tenant.id, w.id);
      expect(dbW?.status).toBe("INACTIVE");
    }
  });

  test("runs durable workflow end-to-end through full Worker loop", async () => {
    const tenant = await tenants.create({
      name: "End to End Corp",
      slug: `e2e-${Date.now()}`,
    });

    const wf = await workflows.create({
      tenantId: tenant.id,
      key: "checkout-flow",
      name: "Checkout Flow",
    });

    const ver = await versions.create({
      workflowId: wf.id,
      version: 1,
      definition: { steps: ["stepA", "stepB"] },
      checksum: "chk-e2e",
      isActive: true,
    });

    let stepAExecuted = false;
    let stepBExecuted = false;

    const checkoutFlow = defineWorkflow({
      name: "checkout-flow",
      version: 1,
      steps: [
        {
          id: "stepA",
          execute: async () => {
            stepAExecuted = true;
            return { item: "book" };
          },
        },
        {
          id: "stepB",
          execute: async (ctx) => {
            stepBExecuted = true;
            return { processed: ctx.previousOutput };
          },
        },
      ],
    });

    const worker = new Worker({
      client,
      workerRepo: workers,
      jobRepo: jobs,
      runRepo: runs,
      stepRepo: steps,
      eventRepo: events,
      workflowRepo: workflows,
      versionRepo: versions,
      tenantId: tenant.id,
      pollIntervalMs: 50,
      autoRecoverLeases: false,
    });
    activeWorkers.push(worker);

    worker.registerWorkflow(checkoutFlow);

    // Create job for workflow execution
    const job = await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "workflow.dispatch",
      payload: {
        workflowId: wf.id,
        versionId: ver.id,
        input: { cartId: "cart-123" },
      },
    });

    await worker.start();

    // Wait for worker loop to pick up and finish the workflow
    const start = Date.now();
    let jobDone = false;
    while (!jobDone && Date.now() - start < 4000) {
      const current = await jobs.findById(tenant.id, job.id);
      if (current?.status === "COMPLETED") {
        jobDone = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(jobDone).toBe(true);
    expect(stepAExecuted).toBe(true);
    expect(stepBExecuted).toBe(true);

    await worker.stop();
  });
});
