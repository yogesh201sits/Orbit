import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import {
  PrismaClient,
  createClient,
  disconnect,
  healthCheck,
  PrismaTenantRepository,
  PrismaWorkflowRepository,
  PrismaWorkflowVersionRepository,
  PrismaWorkflowRunRepository,
  PrismaWorkflowStepRepository,
  PrismaWorkflowEventRepository,
  PrismaJobRepository,
  PrismaWorkerRepository,
  PrismaOutboxRepository,
  withTransaction,
  NotFoundError,
  ConflictError,
  StaleRevisionError,
} from "@durable/storage";

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:postgres@localhost:5432/orbit_test";

let client: PrismaClient;

let tenants: PrismaTenantRepository;
let workflows: PrismaWorkflowRepository;
let versions: PrismaWorkflowVersionRepository;
let runs: PrismaWorkflowRunRepository;
let steps: PrismaWorkflowStepRepository;
let events: PrismaWorkflowEventRepository;
let jobs: PrismaJobRepository;
let workers: PrismaWorkerRepository;
let outbox: PrismaOutboxRepository;

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
  outbox = new PrismaOutboxRepository(client);
});

afterAll(async () => {
  await disconnect(client);
});

beforeEach(async () => {
  // Clean all tables in dependency order
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

// ─── Connection ────────────────────────────────────────────────────

describe("Database Connection", () => {
  test("health check returns true", async () => {
    const healthy = await healthCheck(client);
    expect(healthy).toBe(true);
  });
});

// ─── Tenants ───────────────────────────────────────────────────────

describe("TenantRepository", () => {
  test("creates and retrieves a tenant", async () => {
    const tenant = await tenants.create({
      name: "Acme Corp",
      slug: "acme-corp",
      metadata: { plan: "enterprise" },
    });

    expect(tenant.id).toBeDefined();
    expect(tenant.name).toBe("Acme Corp");
    expect(tenant.slug).toBe("acme-corp");
    expect(tenant.metadata).toEqual({ plan: "enterprise" });
    expect(tenant.createdAt).toBeInstanceOf(Date);

    const found = await tenants.findById(tenant.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(tenant.id);
  });

  test("finds tenant by slug", async () => {
    await tenants.create({ name: "Test", slug: "test-slug" });
    const found = await tenants.findBySlug("test-slug");
    expect(found).not.toBeNull();
    expect(found!.slug).toBe("test-slug");
  });

  test("updates a tenant", async () => {
    const tenant = await tenants.create({ name: "Old Name", slug: "update-test" });
    const updated = await tenants.update(tenant.id, { name: "New Name" });
    expect(updated.name).toBe("New Name");
  });

  test("deletes a tenant", async () => {
    const tenant = await tenants.create({ name: "Delete Me", slug: "delete-me" });
    await tenants.delete(tenant.id);
    const found = await tenants.findById(tenant.id);
    expect(found).toBeNull();
    const retained = await client.tenant.findUnique({ where: { id: tenant.id } });
    expect(retained?.deletedAt).toBeInstanceOf(Date);
  });

  test("rejects duplicate slug", async () => {
    await tenants.create({ name: "First", slug: "dup-slug" });
    await expect(
      tenants.create({ name: "Second", slug: "dup-slug" })
    ).rejects.toThrow(ConflictError);
  });

  test("paginates tenant list", async () => {
    await tenants.create({ name: "T1", slug: "t1" });
    await tenants.create({ name: "T2", slug: "t2" });
    await tenants.create({ name: "T3", slug: "t3" });

    const page1 = await tenants.list({ limit: 2, offset: 0 });
    expect(page1.data.length).toBe(2);
    expect(page1.total).toBe(3);
    expect(page1.limit).toBe(2);
    expect(page1.offset).toBe(0);

    const page2 = await tenants.list({ limit: 2, offset: 2 });
    expect(page2.data.length).toBe(1);
  });

  test("throws NotFoundError on update of missing tenant", async () => {
    await expect(
      tenants.update("00000000-0000-0000-0000-000000000000", { name: "x" })
    ).rejects.toThrow(NotFoundError);
  });

  test("throws NotFoundError on delete of missing tenant", async () => {
    await expect(
      tenants.delete("00000000-0000-0000-0000-000000000000")
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── Workflows ─────────────────────────────────────────────────────

describe("WorkflowRepository", () => {
  let tenantId: string;

  beforeEach(async () => {
    const tenant = await tenants.create({
      name: "WF Tenant",
      slug: `wf-tenant-${Date.now()}`,
    });
    tenantId = tenant.id;
  });

  test("creates and retrieves a workflow", async () => {
    const wf = await workflows.create({
      tenantId,
      key: "order-processing",
      name: "Order Processing",
      metadata: { category: "commerce" },
    });

    expect(wf.tenantId).toBe(tenantId);
    expect(wf.key).toBe("order-processing");

    const found = await workflows.findById(tenantId, wf.id);
    expect(found).not.toBeNull();
  });

  test("finds workflow by key", async () => {
    await workflows.create({
      tenantId,
      key: "my-workflow",
      name: "My Workflow",
    });
    const found = await workflows.findByKey(tenantId, "my-workflow");
    expect(found).not.toBeNull();
    expect(found!.key).toBe("my-workflow");
  });

  test("enforces unique tenant+key", async () => {
    await workflows.create({ tenantId, key: "dup-key", name: "First" });
    await expect(
      workflows.create({ tenantId, key: "dup-key", name: "Second" })
    ).rejects.toThrow(ConflictError);
  });

  test("tenant isolation: same key in different tenants", async () => {
    const tenant2 = await tenants.create({
      name: "Other Tenant",
      slug: `other-${Date.now()}`,
    });

    await workflows.create({ tenantId, key: "shared-key", name: "A" });
    const wf2 = await workflows.create({
      tenantId: tenant2.id,
      key: "shared-key",
      name: "B",
    });

    expect(wf2.key).toBe("shared-key");

    // Verify tenant isolation in queries
    const fromTenant1 = await workflows.findByKey(tenantId, "shared-key");
    const fromTenant2 = await workflows.findByKey(tenant2.id, "shared-key");
    expect(fromTenant1!.name).toBe("A");
    expect(fromTenant2!.name).toBe("B");
  });
});

// ─── Workflow Versions ─────────────────────────────────────────────

describe("WorkflowVersionRepository", () => {
  let tenantId: string;
  let workflowId: string;

  beforeEach(async () => {
    const tenant = await tenants.create({
      name: "Ver Tenant",
      slug: `ver-tenant-${Date.now()}`,
    });
    tenantId = tenant.id;
    const wf = await workflows.create({
      tenantId,
      key: `wf-ver-${Date.now()}`,
      name: "Versioned WF",
    });
    workflowId = wf.id;
  });

  test("creates a version with JSONB definition", async () => {
    const ver = await versions.create({
      workflowId,
      version: 1,
      definition: { steps: [{ id: "step1", type: "run" }] },
      checksum: "abc123",
    });

    expect(ver.version).toBe(1);
    expect(ver.definition).toEqual({ steps: [{ id: "step1", type: "run" }] });
    expect(ver.isActive).toBe(false);
  });

  test("enforces unique workflow+version", async () => {
    await versions.create({
      workflowId,
      version: 1,
      definition: {},
      checksum: "a",
    });
    await expect(
      versions.create({ workflowId, version: 1, definition: {}, checksum: "b" })
    ).rejects.toThrow(ConflictError);
  });

  test("activates a version and deactivates others", async () => {
    const v1 = await versions.create({
      workflowId,
      version: 1,
      definition: {},
      checksum: "a",
      isActive: true,
    });
    const v2 = await versions.create({
      workflowId,
      version: 2,
      definition: {},
      checksum: "b",
    });

    expect(v1.isActive).toBe(true);
    expect(v2.isActive).toBe(false);

    await versions.activate(v2.id);

    const reloadV1 = await versions.findById(v1.id);
    const reloadV2 = await versions.findById(v2.id);

    expect(reloadV1!.isActive).toBe(false);
    expect(reloadV2!.isActive).toBe(true);
  });

  test("finds active version", async () => {
    await versions.create({
      workflowId,
      version: 1,
      definition: { v: 1 },
      checksum: "a",
      isActive: true,
    });

    const active = await versions.findActiveVersion(workflowId);
    expect(active).not.toBeNull();
    expect(active!.version).toBe(1);
  });
});

// ─── Workflow Runs ─────────────────────────────────────────────────

describe("WorkflowRunRepository", () => {
  let tenantId: string;
  let workflowId: string;
  let versionId: string;

  beforeEach(async () => {
    const tenant = await tenants.create({
      name: "Run Tenant",
      slug: `run-tenant-${Date.now()}`,
    });
    tenantId = tenant.id;
    const wf = await workflows.create({
      tenantId,
      key: `wf-run-${Date.now()}`,
      name: "Run WF",
    });
    workflowId = wf.id;
    const ver = await versions.create({
      workflowId,
      version: 1,
      definition: {},
      checksum: "x",
      isActive: true,
    });
    versionId = ver.id;
  });

  test("creates a run with pending status and revision 1", async () => {
    const run = await runs.create({
      tenantId,
      workflowId,
      versionId,
      input: { orderId: 42 },
    });

    expect(run.status).toBe("PENDING");
    expect(run.revision).toBe(1);
    expect(run.input).toEqual({ orderId: 42 });
  });

  test("updates with optimistic concurrency", async () => {
    const run = await runs.create({ tenantId, workflowId, versionId });

    const updated = await runs.update(tenantId, run.id, {
      status: "RUNNING",
      startedAt: new Date(),
    }, 1);

    expect(updated.status).toBe("RUNNING");
    expect(updated.revision).toBe(2);
    const outboxEvent = await client.outboxEvent.findFirst({
      where: {
        aggregateType: "workflow_run",
        aggregateId: run.id,
        eventType: "workflow_run.status_changed",
      },
    });
    expect(outboxEvent).not.toBeNull();
  });

  test("rejects stale revision", async () => {
    const run = await runs.create({ tenantId, workflowId, versionId });

    // Update once (revision 1 → 2)
    await runs.update(tenantId, run.id, { status: "RUNNING" }, 1);

    // Try updating with stale revision 1
    await expect(
      runs.update(tenantId, run.id, { status: "COMPLETED" }, 1)
    ).rejects.toThrow(StaleRevisionError);
  });

  test("filters runs by status", async () => {
    await runs.create({ tenantId, workflowId, versionId });
    const run2 = await runs.create({ tenantId, workflowId, versionId });
    await runs.update(tenantId, run2.id, { status: "RUNNING" }, 1);

    const pending = await runs.list(
      tenantId,
      { status: "PENDING" },
      { limit: 10, offset: 0 }
    );
    expect(pending.data.length).toBe(1);
    expect(pending.total).toBe(1);
  });

  test("JSONB output and error persistence", async () => {
    const run = await runs.create({ tenantId, workflowId, versionId });

    await runs.update(tenantId, run.id, {
      status: "FAILED",
      error: { code: "TIMEOUT", message: "Step timed out", stack: ["line1"] },
    }, 1);

    const found = await runs.findById(tenantId, run.id);
    expect(found!.error).toEqual({
      code: "TIMEOUT",
      message: "Step timed out",
      stack: ["line1"],
    });
  });
});

// ─── Workflow Steps ────────────────────────────────────────────────

describe("WorkflowStepRepository", () => {
  let tenantId: string;
  let runId: string;

  beforeEach(async () => {
    const tenant = await tenants.create({
      name: "Step Tenant",
      slug: `step-tenant-${Date.now()}`,
    });
    tenantId = tenant.id;
    const wf = await workflows.create({
      tenantId,
      key: `wf-step-${Date.now()}`,
      name: "Step WF",
    });
    const ver = await versions.create({
      workflowId: wf.id,
      version: 1,
      definition: {},
      checksum: "x",
      isActive: true,
    });
    const run = await runs.create({
      tenantId,
      workflowId: wf.id,
      versionId: ver.id,
    });
    runId = run.id;
  });

  test("creates and retrieves a step", async () => {
    const step = await steps.create({
      runId,
      stepKey: "send-email",
      type: "action",
      input: { to: "user@example.com" },
    });

    expect(step.stepKey).toBe("send-email");
    expect(step.status).toBe("PENDING");

    const found = await steps.findByRunAndKey(runId, "send-email");
    expect(found).not.toBeNull();
  });

  test("enforces unique run+stepKey", async () => {
    await steps.create({ runId, stepKey: "dup-step", type: "action" });
    await expect(
      steps.create({ runId, stepKey: "dup-step", type: "action" })
    ).rejects.toThrow(ConflictError);
  });

  test("updates step status and output", async () => {
    const step = await steps.create({ runId, stepKey: "compute", type: "run" });
    const updated = await steps.update(step.id, {
      status: "COMPLETED",
      output: { result: 42 },
      completedAt: new Date(),
    });

    expect(updated.status).toBe("COMPLETED");
    expect(updated.output).toEqual({ result: 42 });
  });

  test("lists steps for a run in order", async () => {
    await steps.create({ runId, stepKey: "step-a", type: "action" });
    await steps.create({ runId, stepKey: "step-b", type: "action" });

    const list = await steps.listByRun(runId);
    expect(list.length).toBe(2);
  });
});

// ─── Workflow Events ───────────────────────────────────────────────

describe("WorkflowEventRepository", () => {
  let runId: string;

  beforeEach(async () => {
    const tenant = await tenants.create({
      name: "Event Tenant",
      slug: `event-tenant-${Date.now()}`,
    });
    const wf = await workflows.create({
      tenantId: tenant.id,
      key: `wf-evt-${Date.now()}`,
      name: "Event WF",
    });
    const ver = await versions.create({
      workflowId: wf.id,
      version: 1,
      definition: {},
      checksum: "x",
      isActive: true,
    });
    const run = await runs.create({
      tenantId: tenant.id,
      workflowId: wf.id,
      versionId: ver.id,
    });
    runId = run.id;
  });

  test("creates events with sequence ordering", async () => {
    await events.create({ runId, type: "run.started" });
    await events.create({
      runId,
      type: "step.completed",
      payload: { stepKey: "s1" },
    });

    const list = await events.listByRun(runId);
    expect(list.length).toBe(2);
    expect(list[0]!.sequence).toBe(1);
    expect(list[1]!.sequence).toBe(2);
  });

  test("gets latest sequence number", async () => {
    await events.create({ runId, type: "a" });
    await events.create({ runId, type: "b" });

    const latest = await events.getLatestSequence(runId);
    expect(latest).toBe(2);
  });

  test("serializes concurrent event sequence allocation", async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        events.create({ runId, type: `concurrent.${index}` })
      )
    );

    const list = await events.listByRun(runId);
    expect(list.map((event) => event.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  test("returns 0 for empty run", async () => {
    const latest = await events.getLatestSequence(runId);
    expect(latest).toBe(0);
  });
});

// ─── Jobs ──────────────────────────────────────────────────────────

describe("JobRepository", () => {
  let tenantId: string;

  beforeEach(async () => {
    const tenant = await tenants.create({
      name: "Job Tenant",
      slug: `job-tenant-${Date.now()}`,
    });
    tenantId = tenant.id;
  });

  test("creates and retrieves a job", async () => {
    const job = await jobs.create({
      tenantId,
      queue: "default",
      type: "process-order",
      payload: { orderId: 1 },
      priority: 5,
    });

    expect(job.status).toBe("PENDING");
    expect(job.priority).toBe(5);
    expect(job.maxRetries).toBe(3);

    const found = await jobs.findById(tenantId, job.id);
    expect(found).not.toBeNull();
  });

  test("dequeues highest priority job", async () => {
    await jobs.create({
      tenantId,
      queue: "q1",
      type: "low",
      payload: {},
      priority: 1,
    });
    await jobs.create({
      tenantId,
      queue: "q1",
      type: "high",
      payload: {},
      priority: 10,
    });

    const worker = await workers.create({
      tenantId,
      name: "claim-worker",
      queues: ["q1"],
    });
    const dequeued = await jobs.dequeue(tenantId, ["q1"], worker.id);
    expect(dequeued).not.toBeNull();
    expect(dequeued!.type).toBe("high");
    expect(dequeued!.status).toBe("RUNNING");
    expect(dequeued!.fencingToken).toBe(1n);
    expect(dequeued!.leaseOwner).toBe(worker.id);
  });

  test("returns null when queue is empty", async () => {
    const worker = await workers.create({
      tenantId,
      name: "empty-worker",
      queues: ["empty-queue"],
    });
    const dequeued = await jobs.dequeue(tenantId, ["empty-queue"], worker.id);
    expect(dequeued).toBeNull();
  });

  test("recovers expired leases and fences the previous claim", async () => {
    const worker = await workers.create({
      tenantId,
      name: "recovery-worker",
      queues: ["recovery"],
    });
    const created = await jobs.create({
      tenantId,
      queue: "recovery",
      type: "recover-me",
      payload: {},
      maxRetries: 2,
    });
    const claimed = await jobs.dequeue(
      tenantId,
      ["recovery"],
      worker.id,
      60_000
    );
    expect(claimed).not.toBeNull();

    await client.job.update({
      where: { id: created.id },
      data: { leaseExpiresAt: new Date(Date.now() - 1_000) },
    });
    expect(await jobs.recoverExpiredLeases()).toBe(1);

    const recovered = await jobs.findById(tenantId, created.id);
    expect(recovered?.status).toBe("PENDING");
    expect(recovered?.retryCount).toBe(1);
    expect(recovered?.fencingToken).toBe(2n);
    await expect(
      jobs.update(
        tenantId,
        created.id,
        { status: "COMPLETED", expectedFencingToken: 1n }
      )
    ).rejects.toThrow(ConflictError);
  });
});

// ─── Workers ───────────────────────────────────────────────────────

describe("WorkerRepository", () => {
  let tenantId: string;

  beforeEach(async () => {
    const tenant = await tenants.create({
      name: "Worker Tenant",
      slug: `worker-tenant-${Date.now()}`,
    });
    tenantId = tenant.id;
  });

  test("creates and lists active workers", async () => {
    await workers.create({
      tenantId,
      name: "worker-1",
      queues: ["default", "high"],
    });

    const active = await workers.listActive(tenantId);
    expect(active.length).toBe(1);
    expect(active[0]!.queues).toEqual(["default", "high"]);
  });

  test("heartbeat updates last_heartbeat", async () => {
    const worker = await workers.create({
      tenantId,
      name: "hb-worker",
      queues: ["q1"],
    });

    // Small delay to ensure different timestamp
    await new Promise((r) => setTimeout(r, 10));
    const updated = await workers.heartbeat(tenantId, worker.id);
    expect(updated.lastHeartbeat!.getTime()).toBeGreaterThanOrEqual(
      worker.lastHeartbeat!.getTime()
    );
  });

  test("deactivate removes from active list", async () => {
    const worker = await workers.create({
      tenantId,
      name: "deactivated",
      queues: ["q1"],
    });

    await workers.deactivate(tenantId, worker.id);
    const active = await workers.listActive(tenantId);
    expect(active.length).toBe(0);
  });
});

// ─── Outbox ────────────────────────────────────────────────────────

describe("OutboxRepository", () => {
  let tenantId: string;

  beforeEach(async () => {
    const tenant = await tenants.create({
      name: "Outbox Tenant",
      slug: `outbox-tenant-${Date.now()}`,
    });
    tenantId = tenant.id;
  });

  test("creates and fetches unpublished events", async () => {
    await outbox.create({
      tenantId,
      aggregateType: "workflow_run",
      aggregateId: "00000000-0000-0000-0000-000000000001",
      eventType: "run.completed",
      payload: { runId: "abc" },
    });

    const unpublished = await outbox.fetchUnpublished(10);
    expect(unpublished.length).toBe(1);
    expect(unpublished[0]!.published).toBe(false);
  });

  test("marks events as published", async () => {
    const evt = await outbox.create({
      tenantId,
      aggregateType: "workflow_run",
      aggregateId: "00000000-0000-0000-0000-000000000002",
      eventType: "run.started",
      payload: {},
    });

    await outbox.markPublished([evt.id]);

    const unpublished = await outbox.fetchUnpublished(10);
    expect(unpublished.length).toBe(0);
  });
});

// ─── Transactions ──────────────────────────────────────────────────

describe("Transactions", () => {
  test("commits on success", async () => {
    const result = await withTransaction(client, async (tx) => {
      const tenant = await tenants.create(
        { name: "TX Tenant", slug: `tx-${Date.now()}` },
        tx
      );
      const wf = await workflows.create(
        { tenantId: tenant.id, key: "tx-wf", name: "TX WF" },
        tx
      );
      return { tenantId: tenant.id, workflowId: wf.id };
    });

    // Verify both persisted
    const tenant = await tenants.findById(result.tenantId);
    const wf = await workflows.findById(result.tenantId, result.workflowId);
    expect(tenant).not.toBeNull();
    expect(wf).not.toBeNull();
  });

  test("rolls back on error", async () => {
    const slug = `rollback-${Date.now()}`;
    let capturedTenantId: string | null = null;

    try {
      await withTransaction(client, async (tx) => {
        const tenant = await tenants.create(
          { name: "Rollback", slug },
          tx
        );
        capturedTenantId = tenant.id;

        // Force an error
        throw new Error("Intentional rollback");
      });
    } catch {
      // expected
    }

    // Verify nothing was persisted
    if (capturedTenantId) {
      const found = await tenants.findById(capturedTenantId);
      expect(found).toBeNull();
    }

    const bySlug = await tenants.findBySlug(slug);
    expect(bySlug).toBeNull();
  });

  test("transaction with outbox pattern", async () => {
    await withTransaction(client, async (tx) => {
      const tenant = await tenants.create(
        { name: "Outbox TX", slug: `outbox-tx-${Date.now()}` },
        tx
      );
      const wf = await workflows.create(
        { tenantId: tenant.id, key: "outbox-wf", name: "Outbox WF" },
        tx
      );
      const ver = await versions.create(
        { workflowId: wf.id, version: 1, definition: {}, checksum: "a", isActive: true },
        tx
      );
      const run = await runs.create(
        { tenantId: tenant.id, workflowId: wf.id, versionId: ver.id },
        tx
      );

      // Write to outbox in same transaction
      await outbox.create(
        {
          tenantId: tenant.id,
          aggregateType: "workflow_run",
          aggregateId: run.id,
          eventType: "run.created",
          payload: { runId: run.id },
        },
        tx
      );
    });

    // Both the run and outbox event should exist
    const unpublished = await outbox.fetchUnpublished(10);
    expect(unpublished.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Cascade Deletes ───────────────────────────────────────────────

describe("Retention deletion", () => {
  test("deleting a tenant retains related records for explicit cleanup", async () => {
    const tenant = await tenants.create({
      name: "Cascade Tenant",
      slug: `cascade-${Date.now()}`,
    });
    const wf = await workflows.create({
      tenantId: tenant.id,
      key: "cascade-wf",
      name: "Cascade WF",
    });
    const ver = await versions.create({
      workflowId: wf.id,
      version: 1,
      definition: {},
      checksum: "a",
      isActive: true,
    });
    const run = await runs.create({
      tenantId: tenant.id,
      workflowId: wf.id,
      versionId: ver.id,
    });
    await steps.create({ runId: run.id, stepKey: "s1", type: "action" });
    await events.create({ runId: run.id, type: "evt" });

    await tenants.delete(tenant.id);

    const retainedTenant = await client.tenant.findUnique({
      where: { id: tenant.id },
    });
    const foundWf = await client.workflow.findUnique({ where: { id: wf.id } });
    const foundVer = await client.workflowVersion.findUnique({ where: { id: ver.id } });
    const foundRun = await client.workflowRun.findUnique({ where: { id: run.id } });
    const foundStep = await client.workflowStep.findFirst({
      where: { runId: run.id },
    });
    const foundEvent = await client.workflowEvent.findFirst({
      where: { runId: run.id },
    });
    expect(retainedTenant?.deletedAt).toBeInstanceOf(Date);
    expect(foundWf?.deletedAt).toBeNull();
    expect(foundVer).not.toBeNull();
    expect(foundRun).not.toBeNull();
    expect(foundStep).not.toBeNull();
    expect(foundEvent).not.toBeNull();
  });
});
