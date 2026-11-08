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
  type PrismaClient,
} from "@durable/storage";
import { defineWorkflow, ExecutionEngine } from "@durable/engine";

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

beforeAll(async () => {
  client = createClient(DATABASE_URL);
  tenants = new PrismaTenantRepository(client);
  workflows = new PrismaWorkflowRepository(client);
  versions = new PrismaWorkflowVersionRepository(client);
  runs = new PrismaWorkflowRunRepository(client);
  steps = new PrismaWorkflowStepRepository(client);
  events = new PrismaWorkflowEventRepository(client);
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

describe("Durable Crash Recovery with PostgreSQL", () => {
  test("recovers interrupted workflow without re-executing completed steps", async () => {
    // 1. Create tenant, workflow definition & version in database
    const tenant = await tenants.create({
      name: "Acme Recovery Inc",
      slug: `recovery-${Date.now()}`,
    });

    const wfRecord = await workflows.create({
      tenantId: tenant.id,
      key: "payment-flow",
      name: "Payment Flow",
    });

    const verRecord = await versions.create({
      workflowId: wfRecord.id,
      version: 1,
      definition: { steps: ["validate", "charge", "notify"] },
      checksum: "chk-123",
      isActive: true,
    });

    // Track execution counts per step across crashes
    let step1Executions = 0;
    let step2Executions = 0;
    let step3Executions = 0;
    const idempotencyTokensReceived: string[] = [];

    const workflow = defineWorkflow({
      name: "payment-flow",
      version: 1,
      steps: [
        {
          id: "validate",
          execute: async (ctx) => {
            step1Executions++;
            idempotencyTokensReceived.push(ctx.idempotencyKey);
            return { valid: true, orderId: "ord_1001", amount: 250 };
          },
        },
        {
          id: "charge",
          execute: async (ctx) => {
            step2Executions++;
            idempotencyTokensReceived.push(ctx.idempotencyKey);
            const prev = ctx.previousOutput as { orderId: string; amount: number };
            return {
              transactionId: `txn_${prev.orderId}`,
              charged: prev.amount,
            };
          },
        },
        {
          id: "notify",
          execute: async (ctx) => {
            step3Executions++;
            idempotencyTokensReceived.push(ctx.idempotencyKey);
            return {
              notifiedCustomer: true,
              chargeInfo: ctx.previousOutput,
            };
          },
        },
      ],
    });

    // 2. Initial execution: simulate crash during step 2
    // We create the run in PostgreSQL
    const initialRun = await runs.create({
      tenantId: tenant.id,
      workflowId: wfRecord.id,
      versionId: verRecord.id,
      input: { orderId: "ord_1001" },
    });

    // Step 1 executes and finishes
    const step1Record = await steps.create({
      runId: initialRun.id,
      stepKey: "validate",
      type: "action",
      input: { orderId: "ord_1001" },
    });
    await steps.update(step1Record.id, {
      status: "COMPLETED",
      output: { valid: true, orderId: "ord_1001", amount: 250 },
      completedAt: new Date(),
    });
    step1Executions = 1; // Step 1 was executed in the original process

    // Step 2 was started, marked RUNNING in DB, but the process abruptly died!
    const step2Record = await steps.create({
      runId: initialRun.id,
      stepKey: "charge",
      type: "action",
    });
    await steps.update(step2Record.id, {
      status: "RUNNING",
      attempt: 1,
      startedAt: new Date(),
    });
    // Run is still RUNNING
    await runs.update(tenant.id, initialRun.id, { status: "RUNNING" }, initialRun.revision);

    // 3. Crash recovery: A brand-new engine instance starts up
    const recoveryEngine = new ExecutionEngine({
      runRepo: runs,
      stepRepo: steps,
      eventRepo: events,
    });

    // Resume the interrupted run
    const resumeResult = await recoveryEngine.resume(tenant.id, initialRun.id, workflow);

    // 4. Verify durable execution properties
    expect(resumeResult.status).toBe("COMPLETED");

    // CRITICAL: Step 1 MUST NOT have been re-executed!
    expect(step1Executions).toBe(1);

    // Step 2 and 3 executed during recovery
    expect(step2Executions).toBe(1);
    expect(step3Executions).toBe(1);

    // Verify final persisted run state in PostgreSQL
    const finalRun = await runs.findById(tenant.id, initialRun.id);
    expect(finalRun?.status).toBe("COMPLETED");
    expect(finalRun?.output).toEqual({
      notifiedCustomer: true,
      chargeInfo: {
        transactionId: "txn_ord_1001",
        charged: 250,
      },
    });

    // Verify all steps are marked COMPLETED in PostgreSQL
    const allSteps = await steps.listByRun(initialRun.id);
    expect(allSteps.length).toBe(3);
    expect(allSteps.every((s) => s.status === "COMPLETED")).toBe(true);

    // Verify events recorded in PostgreSQL
    const allEvents = await events.listByRun(initialRun.id);
    const eventTypes = allEvents.map((e) => e.type);
    expect(eventTypes).toContain("run.recovered_interrupted_step");
    expect(eventTypes).toContain("step.completed");
    expect(eventTypes).toContain("run.completed");
  });
});
