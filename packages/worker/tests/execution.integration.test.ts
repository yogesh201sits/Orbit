import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
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
import { ExecutionEngine, defineWorkflow } from "@durable/engine";
import { LeaseManager } from "../src/leases/lease-manager";
import { WorkflowRegistry } from "../src/execution/workflow-registry";
import { JobExecutor } from "../src/execution/job-executor";
import { LeaseLostError } from "../src/errors/worker-errors";

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

describe("JobExecutor Integration Tests", () => {
  test("executes custom handler and marks job COMPLETED", async () => {
    const tenant = await tenants.create({
      name: "Custom Handler Test",
      slug: `custom-${Date.now()}`,
    });

    const worker = await workers.create({
      tenantId: tenant.id,
      name: "worker-1",
      queues: ["default"],
    });

    const job = await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "custom.notification",
      payload: { to: "user@example.com", message: "Hello!" },
    });

    const claimed = await jobs.dequeue(
      tenant.id,
      ["default"],
      worker.id,
      15_000
    );
    expect(claimed).not.toBeNull();

    const leaseManager = new LeaseManager({
      client,
      workerId: worker.id,
    });
    const registry = new WorkflowRegistry();

    let handledPayload: any = null;
    registry.registerHandler("custom.notification", async (j) => {
      handledPayload = j.payload;
      return { sent: true };
    });

    const executor = new JobExecutor({
      jobRepo: jobs,
      leaseManager,
      registry,
    });

    const result = await executor.execute(claimed!);
    expect(result.status).toBe("COMPLETED");
    expect(handledPayload).toEqual({ to: "user@example.com", message: "Hello!" });

    // Verify job in database is COMPLETED
    const dbJob = await jobs.findById(tenant.id, claimed!.id);
    expect(dbJob?.status).toBe("COMPLETED");
    expect(dbJob?.completedAt).toBeInstanceOf(Date);
  });

  test("executes durable workflow via @durable/engine and acknowledges completion", async () => {
    const tenant = await tenants.create({
      name: "Workflow Exec Test",
      slug: `wf-exec-${Date.now()}`,
    });

    const wf = await workflows.create({
      tenantId: tenant.id,
      key: "order-processor",
      name: "Order Processor",
    });

    const ver = await versions.create({
      workflowId: wf.id,
      version: 1,
      definition: { steps: ["validate", "charge"] },
      checksum: "chk-1",
      isActive: true,
    });

    const worker = await workers.create({
      tenantId: tenant.id,
      name: "worker-1",
      queues: ["default"],
    });

    // Define workflow
    let step1Executed = false;
    let step2Executed = false;
    const orderWorkflow = defineWorkflow({
      name: "order-processor",
      version: 1,
      steps: [
        {
          id: "validate",
          execute: async () => {
            step1Executed = true;
            return { valid: true };
          },
        },
        {
          id: "charge",
          execute: async (ctx) => {
            step2Executed = true;
            return { orderId: (ctx.workflowInput as any).orderId, charged: true };
          },
        },
      ],
    });

    const engine = new ExecutionEngine({
      runRepo: runs,
      stepRepo: steps,
      eventRepo: events,
    });

    const registry = new WorkflowRegistry();
    registry.registerWorkflow(orderWorkflow);

    const leaseManager = new LeaseManager({
      client,
      workerId: worker.id,
    });

    const executor = new JobExecutor({
      jobRepo: jobs,
      leaseManager,
      registry,
      engine,
      workflowRepo: workflows,
      versionRepo: versions,
      runRepo: runs,
    });

    // Create job dispatched with workflowId
    await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "workflow.dispatch",
      payload: {
        workflowId: wf.id,
        versionId: ver.id,
        input: { orderId: "ORD-999" },
      },
    });

    const claimed = await jobs.dequeue(
      tenant.id,
      ["default"],
      worker.id,
      20_000
    );
    expect(claimed).not.toBeNull();

    const result = await executor.execute(claimed!);
    expect(result.status).toBe("COMPLETED");
    expect(step1Executed).toBe(true);
    expect(step2Executed).toBe(true);

    const dbJob = await jobs.findById(tenant.id, claimed!.id);
    expect(dbJob?.status).toBe("COMPLETED");

    // Verify run was created and completed
    const runList = await runs.list(tenant.id, { workflowId: wf.id }, { limit: 10, offset: 0 });
    expect(runList.data.length).toBe(1);
    expect(runList.data[0]?.status).toBe("COMPLETED");
  });

  test("resumes existing run when runId is in payload", async () => {
    const tenant = await tenants.create({
      name: "Resume Run Test",
      slug: `resume-${Date.now()}`,
    });

    const wf = await workflows.create({
      tenantId: tenant.id,
      key: "two-step",
      name: "Two Step",
    });

    const ver = await versions.create({
      workflowId: wf.id,
      version: 1,
      definition: { steps: ["s1", "s2"] },
      checksum: "chk-2",
      isActive: true,
    });

    // Pre-create run and complete step 1
    const run = await runs.create({
      tenantId: tenant.id,
      workflowId: wf.id,
      versionId: ver.id,
      input: { test: 123 },
    });

    const step1 = await steps.create({
      runId: run.id,
      stepKey: "s1",
      type: "action",
    });
    await steps.update(step1.id, {
      status: "COMPLETED",
      output: { s1Done: true },
      completedAt: new Date(),
    });

    const worker = await workers.create({
      tenantId: tenant.id,
      name: "worker-1",
      queues: ["default"],
    });

    let s1Executions = 0;
    let s2Executions = 0;

    const twoStepWorkflow = defineWorkflow({
      name: "two-step",
      version: 1,
      steps: [
        {
          id: "s1",
          execute: async () => {
            s1Executions++;
            return { s1Done: true };
          },
        },
        {
          id: "s2",
          execute: async () => {
            s2Executions++;
            return { s2Done: true };
          },
        },
      ],
    });

    const engine = new ExecutionEngine({
      runRepo: runs,
      stepRepo: steps,
      eventRepo: events,
    });

    const registry = new WorkflowRegistry();
    registry.registerWorkflow(twoStepWorkflow);

    const leaseManager = new LeaseManager({
      client,
      workerId: worker.id,
    });

    const executor = new JobExecutor({
      jobRepo: jobs,
      leaseManager,
      registry,
      engine,
      workflowRepo: workflows,
      versionRepo: versions,
      runRepo: runs,
    });

    // Job dispatched with runId
    await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "workflow.dispatch",
      payload: {
        runId: run.id,
        workflowKey: "two-step",
      },
    });

    const claimed = await jobs.dequeue(
      tenant.id,
      ["default"],
      worker.id,
      20_000
    );

    const result = await executor.execute(claimed!);
    expect(result.status).toBe("COMPLETED");

    // S1 should have been skipped because it was already completed!
    expect(s1Executions).toBe(0);
    expect(s2Executions).toBe(1);

    const dbJob = await jobs.findById(tenant.id, claimed!.id);
    expect(dbJob?.status).toBe("COMPLETED");
  });

  test("handles execution failures and persists errors", async () => {
    const tenant = await tenants.create({
      name: "Error Test",
      slug: `err-${Date.now()}`,
    });

    const worker = await workers.create({
      tenantId: tenant.id,
      name: "worker-1",
      queues: ["default"],
    });

    await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "failing.job",
      payload: {},
    });

    const claimed = await jobs.dequeue(
      tenant.id,
      ["default"],
      worker.id,
      15_000
    );

    const leaseManager = new LeaseManager({
      client,
      workerId: worker.id,
    });
    const registry = new WorkflowRegistry();

    registry.registerHandler("failing.job", async () => {
      throw new Error("Payment Gateway Timeout");
    });

    const executor = new JobExecutor({
      jobRepo: jobs,
      leaseManager,
      registry,
    });

    const result = await executor.execute(claimed!);
    expect(result.status).toBe("FAILED");

    const dbJob = await jobs.findById(tenant.id, claimed!.id);
    expect(dbJob?.status).toBe("FAILED");
    expect((dbJob?.error as any)?.message).toBe("Payment Gateway Timeout");
  });

  test("stale worker cannot commit after lease loss (fencing protection)", async () => {
    const tenant = await tenants.create({
      name: "Stale Worker Fencing",
      slug: `fencing-${Date.now()}`,
    });

    const worker = await workers.create({
      tenantId: tenant.id,
      name: "worker-1",
      queues: ["default"],
    });

    await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "long.job",
      payload: {},
    });

    const claimed = await jobs.dequeue(
      tenant.id,
      ["default"],
      worker.id,
      10_000
    );

    const leaseManager = new LeaseManager({
      client,
      workerId: worker.id,
    });
    const registry = new WorkflowRegistry();

    // Register a handler that simulates lease loss while running
    registry.registerHandler("long.job", async (_j, signal) => {
      // Simulate recovery reclaiming job in database: bumps fencing token
      await client.$executeRaw`
        UPDATE jobs
        SET fencing_token = fencing_token + 1
        WHERE id = ${claimed!.id}::uuid
      `;

      // Lease manager attempts renewal or checks expiration -> detects loss and aborts
      await leaseManager.renewLease(claimed!.id);

      expect(signal.aborted).toBe(true);
      throw signal.reason;
    });

    const executor = new JobExecutor({
      jobRepo: jobs,
      leaseManager,
      registry,
    });

    const result = await executor.execute(claimed!);
    expect(result.status).toBe("FAILED");
    expect(result.error).toBeInstanceOf(LeaseLostError);

    // Job in DB should NOT have been overwritten or marked COMPLETED by stale worker
    const dbJob = await jobs.findById(tenant.id, claimed!.id);
    expect(dbJob?.status).toBe("RUNNING"); // Still RUNNING as reclaimed by DB, not COMPLETED
  });
});
