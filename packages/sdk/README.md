# `@durable/sdk` — Orbit Function-First Durable Workflow SDK

`@durable/sdk` is the developer-facing SDK for Orbit, enabling developers to author actual TypeScript workflow functions and execute them durably with transparent recovery, explicit error handling, and stable side-effect idempotency.

---

## Architecture: Two Distinct Planes

Orbit cleanly separates two architectural planes:

1. **Control Plane (API / Metadata):**
   - Authentication, workflow metadata, version activation, run dispatch, schedules, run inspection, and operator controls.
   - **Never receives or evaluates arbitrary executable JavaScript.** Workflow metadata (id, version, name, description, schema) is registered via JSON.

2. **Execution Plane (Worker / Runtime):**
   - The developer's worker process loads the real TypeScript workflow handlers and their dependencies.
   - When a job is claimed by a worker, the worker resolves the workflow definition and version from its local registry, invoking the actual handler through the Orbit durable execution engine.

---

## Installation

Within the Orbit monorepo or an application workspace:

```bash
bun add @durable/sdk
```

---

## 1. Quickstart

### Initializing Orbit

```ts
import { Orbit } from "@durable/sdk";

export const orbit = new Orbit({
  apiKey: process.env.ORBIT_API_KEY!,
  baseUrl: process.env.ORBIT_API_URL ?? "http://localhost:3000",
  timeoutMs: 30_000,
});
```

---

## 2. Authoring Workflows

Workflows are authored using standard async TypeScript functions with full static typing and runtime validation via Zod:

```ts
import { z } from "zod";
import { orbit } from "./orbit";

const OrderInputSchema = z.object({
  orderId: z.string(),
  amount: z.number().positive(),
  customerEmail: z.string().email(),
});

export const processOrder = orbit.workflow(
  {
    id: "process-order",
    version: 1,
    name: "Process Customer Order",
    description: "Validates order, charges card, and sends receipt",
    inputSchema: OrderInputSchema,
  },
  async ({ input, step, context }) => {
    // 1. Validate order
    const order = await step.run("validate-order", async () => {
      return validateOrder(input.orderId);
    });

    // 2. Charge payment with custom retry and timeout
    const payment = await step.run(
      "charge-payment",
      async () => {
        // External side effect idempotency key:
        // Automatically stable across retries: tenantId:workflowId:runId:stepId
        return chargePayment({
          orderId: order.id,
          amount: input.amount,
          idempotencyKey: context.idempotencyKey,
        });
      },
      {
        retries: 3,
        timeout: "30s",
      }
    );

    // 3. Register saga compensation in case later steps fail
    step.compensate("refund-payment", async () => {
      await refundPayment(payment.chargeId);
    });

    // 4. Send email confirmation
    await step.run("send-confirmation", async () => {
      await sendReceiptEmail(input.customerEmail, payment);
    });

    return {
      orderId: input.orderId,
      chargeId: payment.chargeId,
      success: true,
    };
  }
);
```

---

## 3. Durable Step Primitives

### `step.run(id, callback, options)`
The core primitive for durable execution:
* Executes callback with retry and timeout policies.
* Persists successful results to PostgreSQL.
* On recovery/crash resume, returns the persisted output without re-executing the callback.
* Guarantees a stable external idempotency key: `${tenantId}:${workflowId}:${runId}:${stepId}` across all retry attempts.

```ts
const user = await step.run("fetch-user", async () => fetchUser(id), {
  retries: 2,
  timeout: "5s",
});
```

### `step.sleep(id, duration)`
Durably suspends execution for a specified duration:
* Does not block or hold worker concurrency slots.
* Parses human duration formats (`"500ms"`, `"10s"`, `"15m"`, `"2h"`, `"1d"`).
* On recovery, skips sleep if the wake-up time has already elapsed.

```ts
await step.sleep("wait-for-reminder", "24h");
```

### `step.waitForEvent(id, options)`
Waits for an external event to correlate with this workflow run:

```ts
const approval = await step.waitForEvent("wait-for-manager", {
  event: "order.approved",
  timeout: "48h",
  correlationKey: input.orderId,
});
```

### `step.emit(event, payload, options)`
Emits an event into Orbit event storage and transactional outbox within a durable step:

```ts
await step.emit("order.processed", { orderId: input.orderId });
```

### `step.parallel(tasks)`
Executes multiple durable steps concurrently and returns a strongly-typed tuple:

```ts
const [profile, preferences] = await step.parallel([
  () => step.run("load-profile", () => loadProfile(input.userId)),
  () => step.run("load-preferences", () => loadPreferences(input.userId)),
]);
```

### `step.compensate(id, callback)`
Registers a saga compensation action:
* If subsequent steps throw an unhandled error, compensations execute in reverse order (LIFO).

```ts
step.compensate("release-lock", async () => {
  await releaseInventoryLock(input.sku);
});
```

### `step.child(id, childWorkflow, input, options)`
Executes another registered workflow as a durable child run.

---

## 4. Worker Integration

Workers import workflow definitions and register them in their execution registry:

```ts
import { Worker } from "@durable/worker";
import { orbit, processOrder } from "./workflows";

const worker = new Worker({
  client: prismaClient,
  tenantId: "my-tenant",
  workerRepo,
  jobRepo,
  runRepo,
  stepRepo,
  eventRepo,
  workflowRepo,
  versionRepo,
});

// Register workflows directly into the worker
orbit.registerInWorker(worker, [processOrder]);

// Start claiming and executing durable workflow jobs
await worker.start();
```

---

## 5. Control Plane Registration

Publish workflow metadata and versions to the Orbit API:

```ts
await orbit.register([processOrder]);
```

---

## 6. Management Client Operations

### Workflow Runs
```ts
// Create run
const { run, isIdempotentReplay } = await orbit.runs.create("process-order", {
  input: { orderId: "ord_100", amount: 250, customerEmail: "user@example.com" },
  idempotencyKey: "req_ord_100",
});

// Inspect run
const details = await orbit.runs.get(run.id);

// List runs
const { runs } = await orbit.runs.list({
  workflowId: "process-order",
  status: "FAILED",
  limit: 20,
});

// Cancel run
await orbit.runs.cancel(run.id);

// Retry run
await orbit.runs.retry(run.id);

// View step history and audit events
const steps = await orbit.runs.steps(run.id);
const events = await orbit.runs.events(run.id);
```

### Schedules
```ts
// Create recurring cron schedule
const schedule = await orbit.schedules.create({
  workflowId: "process-order",
  cronExpression: "0 9 * * 1-5",
  timezone: "America/New_York",
  input: { batch: true },
});
```

---

## 7. Testing

Run all unit and integration tests:

```bash
bun test packages/sdk
```

Run PostgreSQL durable recovery tests:

```bash
bun test packages/sdk/tests/integration/e2e-workflow.integration.test.ts
```
