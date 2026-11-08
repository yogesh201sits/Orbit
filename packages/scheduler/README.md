# @durable/scheduler

Distributed workflow scheduler for Orbit.

The scheduler handles one-time delayed executions, recurring workflows using cron expressions, multi-scheduler coordination, and reliable dispatch with PostgreSQL.

---

## Capabilities

1. **One-Time & Delayed Scheduling**: Schedule execution immediately, at a specific timestamp (`runAt`), or after a delay (`delayMs`).
2. **Recurring Workflows**: Cron expressions with explicit timezone support and deterministic missed execution handling.
3. **Multi-Instance Coordination**: Database-backed coordination with `SELECT ... FOR UPDATE SKIP LOCKED` prevents duplicate dispatch across multiple scheduler instances.
4. **Crash Recovery & Lease Fencing**: Leases expire automatically after scheduler downtime and are claimed by surviving instances.
5. **Transactional Dispatch**: Workflow runs and jobs are created inside atomic database transactions alongside schedule state advancement.

---

## Scheduling API

```typescript
import { Scheduler } from "@durable/scheduler";

const scheduler = new Scheduler({
  client: prismaClient,
  scheduleRepo,
  jobRepo,
  runRepo,
  versionRepo,
});

// 1. One-time delayed execution
const delayed = await scheduler.schedule({
  tenantId,
  workflowId,
  input: { orderId: "order_123" },
  runAt: new Date(Date.now() + 60_000), // in 1 minute
});

// 2. Recurring execution with cron and timezone
const recurring = await scheduler.scheduleRecurring({
  tenantId,
  workflowId,
  cronExpression: "0 9 * * 1-5", // 9 AM Mon-Fri
  timezone: "America/New_York",
  input: { report: "daily-summary" },
  missedExecutionPolicy: "SKIP", // SKIP, LATEST, or CATCH_UP
});

// 3. Reschedule an existing schedule
await scheduler.reschedule(tenantId, recurring.id, {
  cronExpression: "0 10 * * 1-5", // update to 10 AM
});

// 4. Cancel a schedule
await scheduler.cancel(tenantId, delayed.id);
```

---

## Delivery & Execution Guarantees

### Idempotent Scheduling vs At-Least-Once Execution

It is essential to distinguish between **scheduling** and **execution**:

1. **Idempotent Scheduling (Scheduler Layer)**:
   - The scheduler uses `FOR UPDATE SKIP LOCKED` and database leases (`lease_owner`, `lease_expires_at`).
   - Only **one scheduler instance** can claim and advance any given schedule execution.
   - Run creation, job queue enqueue, and timestamp advancement occur within an atomic PostgreSQL transaction (`withTransaction`). If an error occurs, the transaction rolls back, leaving schedule timestamps untouched.

2. **At-Least-Once Execution (Worker Layer)**:
   - Once a job is enqueued in `jobs`, workers pull and execute workflows.
   - If a worker crashes after completing an external side-effect (e.g. charging a credit card) but before committing the step's completion, the workflow will resume and re-execute that step.
   - Orbit provides `ctx.idempotencyKey` to downstream APIs to ensure at-least-once retries do not duplicate external effects.

---

## Missed Execution Policies

When scheduler downtime occurs and scheduled execution times pass before the scheduler recovers, three policies determine behavior:

| Policy | Behavior | Use Case |
| :--- | :--- | :--- |
| `SKIP` | Ignores all missed occurrences, dispatches the original due run, and sets `nextRunAt` to the next future occurrence. | Status checks, heartbeat monitors, periodic cleanups. |
| `LATEST` | Dispatches only the **single most recent** missed occurrence, advancing `nextRunAt` to the future. | State synchronizations where only current state matters. |
| `CATCH_UP` | Dispatches missed occurrences up to a strict cap (`maxCatchUp = 10`), preventing unbounded queue stampedes after extended outages. | Financial settlements, recurring billing, incremental syncs. |

---

## Testing

Run unit tests:
```bash
bun test packages/scheduler
```

Run PostgreSQL integration tests:
```bash
bun test tests/integration/scheduler-dispatch.test.ts
```
