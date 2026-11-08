import { describe, test, expect } from "bun:test";
import { SchedulerClient } from "../../src/scheduling/scheduler-client";
import { InMemoryScheduleRepository } from "../mocks/memory-schedule-repo";
import { InMemoryWorkflowRunRepository } from "../../../engine/tests/mocks/memory-repositories";
import {
  InvalidCronError,
  ScheduleNotFoundError,
  ScheduleCancelledError,
} from "../../src/errors/scheduler-errors";

describe("SchedulerClient (API Tests)", () => {
  const dummyJobRepo: any = {};

  test("1: Immediate scheduling", async () => {
    const scheduleRepo = new InMemoryScheduleRepository();
    const client = new SchedulerClient(scheduleRepo, dummyJobRepo);

    const now = new Date();
    const record = await client.schedule({
      tenantId: "tenant-1",
      workflowId: "wf-1",
      input: { orderId: 100 },
    });

    expect(record.id).toBeDefined();
    expect(record.tenantId).toBe("tenant-1");
    expect(record.workflowId).toBe("wf-1");
    expect(record.isRecurring).toBe(false);
    expect(record.status).toBe("ACTIVE");
    expect(record.nextRunAt.getTime()).toBeGreaterThanOrEqual(now.getTime() - 100);
  });

  test("2: Delayed scheduling (runAt & delayMs)", async () => {
    const scheduleRepo = new InMemoryScheduleRepository();
    const client = new SchedulerClient(scheduleRepo, dummyJobRepo);

    const targetDate = new Date(Date.now() + 60_000);
    const delayed1 = await client.schedule({
      tenantId: "tenant-1",
      workflowId: "wf-1",
      runAt: targetDate,
    });
    expect(delayed1.nextRunAt.getTime()).toBe(targetDate.getTime());

    const delayed2 = await client.schedule({
      tenantId: "tenant-1",
      workflowId: "wf-1",
      delayMs: 30_000,
    });
    expect(delayed2.nextRunAt.getTime()).toBeGreaterThanOrEqual(Date.now() + 29_000);
  });

  test("3: Recurring schedule creation", async () => {
    const scheduleRepo = new InMemoryScheduleRepository();
    const client = new SchedulerClient(scheduleRepo, dummyJobRepo);

    const recurring = await client.scheduleRecurring({
      tenantId: "tenant-1",
      workflowId: "wf-1",
      cronExpression: "0 0 * * *",
      timezone: "UTC",
      input: { report: "daily" },
    });

    expect(recurring.isRecurring).toBe(true);
    expect(recurring.cronExpression).toBe("0 0 * * *");
    expect(recurring.nextRunAt.getTime()).toBeGreaterThan(Date.now());
  });

  test("6: Schedule cancellation", async () => {
    const scheduleRepo = new InMemoryScheduleRepository();
    const client = new SchedulerClient(scheduleRepo, dummyJobRepo);

    const created = await client.schedule({
      tenantId: "tenant-1",
      workflowId: "wf-1",
      delayMs: 50_000,
    });

    const cancelled = await client.cancel("tenant-1", created.id);
    expect(cancelled.status).toBe("CANCELLED");

    // Cannot reschedule cancelled schedule
    await expect(
      client.reschedule("tenant-1", created.id, { delayMs: 10_000 })
    ).rejects.toThrow(ScheduleCancelledError);
  });

  test("7: Schedule rescheduling", async () => {
    const scheduleRepo = new InMemoryScheduleRepository();
    const client = new SchedulerClient(scheduleRepo, dummyJobRepo);

    const created = await client.schedule({
      tenantId: "tenant-1",
      workflowId: "wf-1",
      delayMs: 10_000,
    });

    const newDate = new Date(Date.now() + 100_000);
    const rescheduled = await client.reschedule("tenant-1", created.id, {
      runAt: newDate,
    });

    expect(rescheduled.nextRunAt.getTime()).toBe(newDate.getTime());
  });

  test("Throws on non-existent schedule", async () => {
    const scheduleRepo = new InMemoryScheduleRepository();
    const client = new SchedulerClient(scheduleRepo, dummyJobRepo);

    await expect(client.cancel("tenant-1", "non-existent")).rejects.toThrow(
      ScheduleNotFoundError
    );
  });
});
