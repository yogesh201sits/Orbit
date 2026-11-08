import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import {
  createClient,
  disconnect,
  PrismaTenantRepository,
  PrismaWorkflowRepository,
  PrismaWorkflowVersionRepository,
  PrismaWorkflowRunRepository,
  PrismaJobRepository,
  PrismaScheduleRepository,
  type PrismaClient,
} from "@durable/storage";
import { Scheduler, SchedulerClient } from "@durable/scheduler";

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:1234@localhost:5432/orbit_test?schema=public";

let client: PrismaClient;
let tenants: PrismaTenantRepository;
let workflows: PrismaWorkflowRepository;
let versions: PrismaWorkflowVersionRepository;
let runs: PrismaWorkflowRunRepository;
let jobs: PrismaJobRepository;
let schedules: PrismaScheduleRepository;

beforeAll(async () => {
  client = createClient(DATABASE_URL);
  tenants = new PrismaTenantRepository(client);
  workflows = new PrismaWorkflowRepository(client);
  versions = new PrismaWorkflowVersionRepository(client);
  runs = new PrismaWorkflowRunRepository(client);
  jobs = new PrismaJobRepository(client);
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

describe("Scheduler PostgreSQL Integration Tests", () => {
  test("1 & 2: Schedules delayed execution, persists in PostgreSQL, dispatches when due", async () => {
    const tenant = await tenants.create({
      name: "Delayed Corp",
      slug: `delayed-${Date.now()}`,
    });

    const wf = await workflows.create({
      tenantId: tenant.id,
      key: "delayed-wf",
      name: "Delayed WF",
    });

    const ver = await versions.create({
      workflowId: wf.id,
      version: 1,
      definition: { steps: [] },
      checksum: "chk-1",
      isActive: true,
    });

    const scheduler = new Scheduler({
      client,
      scheduleRepo: schedules,
      jobRepo: jobs,
      runRepo: runs,
      versionRepo: versions,
    });

    // Schedule 10 seconds in future
    const futureTime = new Date(Date.now() + 10_000);
    const scheduled = await scheduler.schedule({
      tenantId: tenant.id,
      workflowId: wf.id,
      input: { amount: 500 },
      runAt: futureTime,
    });

    expect(scheduled.id).toBeDefined();

    // Verify it is not dispatched before it is due
    const preTickResults = await scheduler.tick(new Date(Date.now()));
    expect(preTickResults.length).toBe(0);

    // Now advance clock past futureTime
    const dispatchResults = await scheduler.tick(new Date(futureTime.getTime() + 1000));
    expect(dispatchResults.length).toBe(1);
    expect(dispatchResults[0]!.scheduleId).toBe(scheduled.id);
    expect(dispatchResults[0]!.dispatchedCount).toBe(1);

    // Verify run and job were created transactionally in PostgreSQL
    const createdRuns = await runs.list(tenant.id, {}, { limit: 10, offset: 0 });
    expect(createdRuns.data.length).toBe(1);
    expect(createdRuns.data[0]!.workflowId).toBe(wf.id);
    expect(createdRuns.data[0]!.input).toEqual({ amount: 500 });

    const jobList = await jobs.listByQueue(tenant.id, "default", { limit: 10, offset: 0 });
    expect(jobList.data.length).toBe(1);
    expect(jobList.data[0]!.type).toBe("workflow.dispatch");

    // Verify schedule was marked PAUSED (one-time completion)
    const updatedSchedule = await schedules.findById(tenant.id, scheduled.id);
    expect(updatedSchedule?.status).toBe("PAUSED");
  });

  test("3 & 8: Recurring schedule with cron, timezone and missed execution policy", async () => {
    const tenant = await tenants.create({
      name: "Cron Corp",
      slug: `cron-${Date.now()}`,
    });

    const wf = await workflows.create({
      tenantId: tenant.id,
      key: "cron-wf",
      name: "Cron WF",
    });

    const ver = await versions.create({
      workflowId: wf.id,
      version: 1,
      definition: { steps: [] },
      checksum: "chk-2",
      isActive: true,
    });

    const scheduler = new Scheduler({
      client,
      scheduleRepo: schedules,
      jobRepo: jobs,
      runRepo: runs,
      versionRepo: versions,
    });

    // Hourly cron: 0 * * * *
    const scheduled = await scheduler.scheduleRecurring({
      tenantId: tenant.id,
      workflowId: wf.id,
      cronExpression: "0 * * * *",
      timezone: "UTC",
      input: { tick: 1 },
      missedExecutionPolicy: "SKIP",
      startAt: new Date("2026-01-01T00:00:00Z"),
    });

    // Next run should be 01:00:00
    expect(scheduled.nextRunAt.toISOString()).toBe("2026-01-01T01:00:00.000Z");

    // Simulate ticking at 04:30:00 (downtime occurred, 3 missed runs)
    const tickTime = new Date("2026-01-01T04:30:00Z");
    const results = await scheduler.tick(tickTime);

    expect(results.length).toBe(1);
    // SKIP policy dispatches the original due run and advances to 05:00:00
    expect(results[0]!.dispatchedCount).toBe(1);
    expect(results[0]!.nextRunAt?.toISOString()).toBe("2026-01-01T05:00:00.000Z");

    const updated = await schedules.findById(tenant.id, scheduled.id);
    expect(updated?.nextRunAt.toISOString()).toBe("2026-01-01T05:00:00.000Z");
  });

  test("9 & 10: Duplicate dispatch prevention and concurrent scheduler coordination", async () => {
    const tenant = await tenants.create({
      name: "Concurrent Corp",
      slug: `concurrent-${Date.now()}`,
    });

    const wf = await workflows.create({
      tenantId: tenant.id,
      key: "conc-wf",
      name: "Concurrent WF",
    });

    const ver = await versions.create({
      workflowId: wf.id,
      version: 1,
      definition: { steps: [] },
      checksum: "chk-3",
      isActive: true,
    });

    // Create 6 due schedules
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      await schedules.create({
        tenantId: tenant.id,
        workflowId: wf.id,
        nextRunAt: new Date(now.getTime() - 1000 * (i + 1)),
      });
    }

    // Spin up 3 concurrent scheduler instances with distinct IDs
    const s1 = new Scheduler({
      client,
      scheduleRepo: schedules,
      jobRepo: jobs,
      runRepo: runs,
      versionRepo: versions,
      schedulerId: "00000000-0000-0000-0000-000000000001",
    });

    const s2 = new Scheduler({
      client,
      scheduleRepo: schedules,
      jobRepo: jobs,
      runRepo: runs,
      versionRepo: versions,
      schedulerId: "00000000-0000-0000-0000-000000000002",
    });

    const s3 = new Scheduler({
      client,
      scheduleRepo: schedules,
      jobRepo: jobs,
      runRepo: runs,
      versionRepo: versions,
      schedulerId: "00000000-0000-0000-0000-000000000003",
    });

    // Execute tick concurrently across all 3 instances
    const [r1, r2, r3] = await Promise.all([
      s1.tick(now),
      s2.tick(now),
      s3.tick(now),
    ]);

    const totalDispatched = r1.length + r2.length + r3.length;
    // Exactly 6 schedules must be dispatched in total across the 3 instances
    expect(totalDispatched).toBe(6);

    // All 6 schedule IDs must be unique (zero duplicate dispatches!)
    const allDispatchedIds = [
      ...r1.map((r) => r.scheduleId),
      ...r2.map((r) => r.scheduleId),
      ...r3.map((r) => r.scheduleId),
    ];
    const uniqueIds = new Set(allDispatchedIds);
    expect(uniqueIds.size).toBe(6);
  });

  test("11: Crash recovery recovers expired dispatch leases", async () => {
    const tenant = await tenants.create({
      name: "Crash Corp",
      slug: `crash-${Date.now()}`,
    });

    const wf = await workflows.create({
      tenantId: tenant.id,
      key: "crash-wf",
      name: "Crash WF",
    });

    const ver = await versions.create({
      workflowId: wf.id,
      version: 1,
      definition: { steps: [] },
      checksum: "chk-4",
      isActive: true,
    });

    // Schedule was claimed by a dead scheduler with expired lease in the past
    const deadSchedulerId = "00000000-0000-0000-0000-000000000099";
    const schedule = await schedules.create({
      tenantId: tenant.id,
      workflowId: wf.id,
      nextRunAt: new Date(Date.now() - 60_000),
    });

    await schedules.update(tenant.id, schedule.id, {
      leaseOwner: deadSchedulerId,
      leaseExpiresAt: new Date(Date.now() - 5_000), // Expired 5s ago
    });

    const newScheduler = new Scheduler({
      client,
      scheduleRepo: schedules,
      jobRepo: jobs,
      runRepo: runs,
      versionRepo: versions,
      schedulerId: "00000000-0000-0000-0000-000000000001",
    });

    // Ticking must recover expired lease and successfully dispatch the schedule
    const results = await newScheduler.tick(new Date());
    expect(results.length).toBe(1);
    expect(results[0]!.scheduleId).toBe(schedule.id);

    const afterDispatch = await schedules.findById(tenant.id, schedule.id);
    expect(afterDispatch?.status).toBe("PAUSED");
  });

  test("12: Transaction rollback on dispatch failure preserves schedule state", async () => {
    const tenant = await tenants.create({
      name: "Rollback Corp",
      slug: `rollback-${Date.now()}`,
    });

    const wf = await workflows.create({
      tenantId: tenant.id,
      key: "rollback-wf",
      name: "Rollback WF",
    });

    const runAt = new Date(Date.now() - 5_000);
    const schedule = await schedules.create({
      tenantId: tenant.id,
      workflowId: wf.id,
      nextRunAt: runAt,
    });

    // Mock job repository that fails during transaction
    const failingJobRepo: any = {
      create: async () => {
        throw new Error("Simulated database failure during job creation");
      },
    };

    const failingScheduler = new Scheduler({
      client,
      scheduleRepo: schedules,
      jobRepo: failingJobRepo,
      runRepo: runs,
    });

    // Run tick
    await failingScheduler.tick(new Date());

    // Schedule should NOT have been advanced or paused, lease was cleaned up
    const preserved = await schedules.findById(tenant.id, schedule.id);
    expect(preserved?.status).toBe("ACTIVE");
    expect(preserved?.nextRunAt.getTime()).toBe(runAt.getTime());
    expect(preserved?.leaseOwner).toBeNull();

    // No runs should have been committed
    const runsList = await runs.list(tenant.id, {}, { limit: 10, offset: 0 });
    expect(runsList.data.length).toBe(0);
  });

  test("14: Tenant isolation", async () => {
    const tenantA = await tenants.create({
      name: "Tenant A",
      slug: `tenant-a-${Date.now()}`,
    });
    const tenantB = await tenants.create({
      name: "Tenant B",
      slug: `tenant-b-${Date.now()}`,
    });

    const wfA = await workflows.create({
      tenantId: tenantA.id,
      key: "wf-a",
      name: "WF A",
    });

    const schedA = await schedules.create({
      tenantId: tenantA.id,
      workflowId: wfA.id,
      nextRunAt: new Date(),
    });

    // Tenant B cannot retrieve or cancel Tenant A's schedule
    const lookupByB = await schedules.findById(tenantB.id, schedA.id);
    expect(lookupByB).toBeNull();

    let threw = false;
    try {
      await schedules.cancel(tenantB.id, schedA.id);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
