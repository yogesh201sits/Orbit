import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import {
  createClient,
  disconnect,
  PrismaTenantRepository,
  PrismaWorkflowRepository,
  PrismaScheduleRepository,
  type PrismaClient,
} from "@durable/storage";

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:1234@localhost:5432/orbit_test?schema=public";

let client: PrismaClient;
let tenants: PrismaTenantRepository;
let workflows: PrismaWorkflowRepository;
let schedules: PrismaScheduleRepository;

beforeAll(async () => {
  client = createClient(DATABASE_URL);
  tenants = new PrismaTenantRepository(client);
  workflows = new PrismaWorkflowRepository(client);
  schedules = new PrismaScheduleRepository(client);
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

describe("PrismaScheduleRepository", () => {
  test("creates and retrieves a schedule", async () => {
    const tenant = await tenants.create({
      name: "Sched Tenant",
      slug: `sched-tenant-${Date.now()}`,
    });
    const wf = await workflows.create({
      tenantId: tenant.id,
      key: "cron-wf",
      name: "Cron Workflow",
    });

    const runAt = new Date(Date.now() + 60_000);
    const schedule = await schedules.create({
      tenantId: tenant.id,
      workflowId: wf.id,
      cronExpression: "0 0 * * *",
      timezone: "America/New_York",
      input: { param: "value" },
      missedExecutionPolicy: "CATCH_UP",
      nextRunAt: runAt,
    });

    expect(schedule.id).toBeDefined();
    expect(schedule.tenantId).toBe(tenant.id);
    expect(schedule.workflowId).toBe(wf.id);
    expect(schedule.cronExpression).toBe("0 0 * * *");
    expect(schedule.timezone).toBe("America/New_York");
    expect(schedule.missedExecutionPolicy).toBe("CATCH_UP");
    expect(schedule.status).toBe("ACTIVE");
    expect(schedule.nextRunAt.getTime()).toBe(runAt.getTime());

    const found = await schedules.findById(tenant.id, schedule.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(schedule.id);
  });

  test("claims due schedules atomically with lease", async () => {
    const tenant = await tenants.create({
      name: "Claim Tenant",
      slug: `claim-tenant-${Date.now()}`,
    });
    const wf = await workflows.create({
      tenantId: tenant.id,
      key: "claim-wf",
      name: "Claim WF",
    });

    const pastDate = new Date(Date.now() - 5_000);
    const futureDate = new Date(Date.now() + 60_000);

    // Due schedule
    const due = await schedules.create({
      tenantId: tenant.id,
      workflowId: wf.id,
      nextRunAt: pastDate,
    });

    // Future schedule
    await schedules.create({
      tenantId: tenant.id,
      workflowId: wf.id,
      nextRunAt: futureDate,
    });

    const schedulerId = "00000000-0000-0000-0000-000000000001";
    const claimed = await schedules.claimDueSchedules(schedulerId, 10, 30_000);

    expect(claimed.length).toBe(1);
    expect(claimed[0]!.id).toBe(due.id);
    expect(claimed[0]!.leaseOwner).toBe(schedulerId);
    expect(claimed[0]!.leaseExpiresAt).not.toBeNull();

    // Second claim should find nothing because first schedule is locked with active lease
    const secondClaim = await schedules.claimDueSchedules(
      "00000000-0000-0000-0000-000000000002",
      10,
      30_000
    );
    expect(secondClaim.length).toBe(0);
  });

  test("cancels a schedule", async () => {
    const tenant = await tenants.create({
      name: "Cancel Tenant",
      slug: `cancel-tenant-${Date.now()}`,
    });
    const wf = await workflows.create({
      tenantId: tenant.id,
      key: "cancel-wf",
      name: "Cancel WF",
    });

    const schedule = await schedules.create({
      tenantId: tenant.id,
      workflowId: wf.id,
      nextRunAt: new Date(),
    });

    const cancelled = await schedules.cancel(tenant.id, schedule.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.leaseOwner).toBeNull();
  });
});
