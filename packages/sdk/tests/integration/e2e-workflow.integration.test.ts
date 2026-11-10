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
import { Worker } from "@durable/worker";
import { Orbit } from "../../src/client/orbit";

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

describe("End-to-End Real PostgreSQL Workflow Execution & Recovery", () => {
  test("runs durable function-first workflow with step persistence and crash recovery", async () => {
    const tenant = await tenants.create({
      name: "E2E SDK Corp",
      slug: `e2e-sdk-${Date.now()}`,
    });

    const wfRecord = await workflows.create({
      tenantId: tenant.id,
      key: "order-fulfillment",
      name: "Order Fulfillment",
    });

    const verRecord = await versions.create({
      workflowId: wfRecord.id,
      version: 1,
      definition: { key: "order-fulfillment", version: 1 },
      checksum: "chk-e2e-sdk",
      isActive: true,
    });

    const orbit = new Orbit({ apiKey: "test-sdk-key" });

    let step1ExecutionCount = 0;
    let step2ExecutionCount = 0;
    let step3ExecutionCount = 0;
    let shouldCrashOnStep2 = true;

    // 1. Author real function-first workflow using normal TypeScript functions
    const orderWorkflow = orbit.workflow(
      {
        id: "order-fulfillment",
        version: 1,
        name: "Order Fulfillment",
      },
      async ({ input, step }) => {
        // Step 1: Validate order
        const order = await step.run("validate-order", async () => {
          step1ExecutionCount++;
          return { orderId: (input as any).orderId, valid: true };
        });

        // Step 2: Charge payment (simulates crash on first attempt)
        const payment = await step.run(
          "charge-payment",
          async () => {
            step2ExecutionCount++;
            if (shouldCrashOnStep2) {
              throw new Error("Simulated worker process crash during payment step");
            }
            return { paymentId: "pay_987", status: "CHARGED" };
          },
          { retries: 0 }
        );

        // Step 3: Send confirmation
        const confirmation = await step.run("send-confirmation", async () => {
          step3ExecutionCount++;
          return { sent: true, recipient: "customer@example.com" };
        });

        return {
          orderId: order.orderId,
          paymentId: payment.paymentId,
          confirmation,
          completed: true,
        };
      }
    );

    // 2. Setup Worker 1 (will encounter simulated crash during step 2)
    const worker1 = new Worker({
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
    activeWorkers.push(worker1);

    orbit.registerInWorker(worker1, orderWorkflow);

    // 3. Create run record and dispatch job in PostgreSQL
    const createdRun = await runs.create({
      tenantId: tenant.id,
      workflowId: wfRecord.id,
      versionId: verRecord.id,
      input: { orderId: "ord_prod_456" },
      idempotencyKey: "idem_ord_prod_456",
    });

    const job = await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "workflow.dispatch",
      payload: {
        workflowId: wfRecord.id,
        versionId: verRecord.id,
        runId: createdRun.id,
        input: { orderId: "ord_prod_456" },
      },
    });

    await worker1.start();

    // 4. Wait for Worker 1 to fail the job due to step 2 crash
    const start = Date.now();
    let jobFailed = false;
    while (!jobFailed && Date.now() - start < 4000) {
      const current = await jobs.findById(tenant.id, job.id);
      if (current?.status === "FAILED") {
        jobFailed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(jobFailed).toBe(true);
    expect(step1ExecutionCount).toBe(1);
    expect(step2ExecutionCount).toBe(1);
    expect(step3ExecutionCount).toBe(0);

    // 5. Inspect database persistence: step 1 MUST be COMPLETED with output in PostgreSQL
    const dbStep1 = await steps.findByRunAndKey(createdRun.id, "validate-order");
    expect(dbStep1).not.toBeNull();
    expect(dbStep1!.status).toBe("COMPLETED");
    expect(dbStep1!.output).toEqual({ orderId: "ord_prod_456", valid: true });

    // Step 2 is FAILED
    const dbStep2 = await steps.findByRunAndKey(createdRun.id, "charge-payment");
    expect(dbStep2).not.toBeNull();
    expect(dbStep2!.status).toBe("FAILED");

    // Stop Worker 1
    await worker1.stop();

    // 6. Simulate Recovery: process restarts
    // Worker 2 starts to resume the interrupted run.
    shouldCrashOnStep2 = false; // Issue resolved

    // Re-queue the job to resume execution
    await client.job.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });

    const worker2 = new Worker({
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
    activeWorkers.push(worker2);

    orbit.registerInWorker(worker2, orderWorkflow);
    await worker2.start();

    // 7. Wait for resumed run to complete
    const resumeStart = Date.now();
    let jobDone = false;
    while (!jobDone && Date.now() - resumeStart < 4000) {
      const current = await jobs.findById(tenant.id, job.id);
      if (current?.status === "COMPLETED") {
        jobDone = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(jobDone).toBe(true);

    // 8. CRUCIAL DURABILITY CHECK:
    // Step 1 MUST NOT have been executed again! Its execution count remains 1!
    expect(step1ExecutionCount).toBe(1);
    // Step 2 was executed on retry (now count is 2)
    expect(step2ExecutionCount).toBe(2);
    // Step 3 executed for the first time
    expect(step3ExecutionCount).toBe(1);

    // 9. Verify final run record in PostgreSQL
    const finalRun = await runs.findById(tenant.id, createdRun.id);
    expect(finalRun).not.toBeNull();
    expect(finalRun!.status).toBe("COMPLETED");
    expect(finalRun!.output).toEqual({
      orderId: "ord_prod_456",
      paymentId: "pay_987",
      confirmation: { sent: true, recipient: "customer@example.com" },
      completed: true,
    });

    // 10. Verify all 3 steps exist in PostgreSQL with status COMPLETED
    const allSteps = await steps.listByRun(createdRun.id);
    expect(allSteps).toHaveLength(3);
    for (const s of allSteps) {
      expect(s.status).toBe("COMPLETED");
      expect(s.output).not.toBeNull();
    }

    await worker2.stop();
  });
});
