/**
 * Runnable End-to-End Example for Orbit SDK
 *
 * Run with:
 *   bun run packages/sdk/examples/run-e2e.ts
 */

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
} from "@durable/storage";
import { Worker } from "@durable/worker";
import { orderWorkflow, orbit } from "./order-workflow";

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:1234@localhost:5432/orbit_test?schema=public";

async function main() {
  console.log("🚀 [Orbit Example] Starting End-to-End Workflow Execution...");
  const client = createClient(DATABASE_URL);

  const tenants = new PrismaTenantRepository(client);
  const workflows = new PrismaWorkflowRepository(client);
  const versions = new PrismaWorkflowVersionRepository(client);
  const runs = new PrismaWorkflowRunRepository(client);
  const steps = new PrismaWorkflowStepRepository(client);
  const events = new PrismaWorkflowEventRepository(client);
  const jobs = new PrismaJobRepository(client);
  const workers = new PrismaWorkerRepository(client);

  try {
    // 1. Setup Tenant and Workflow records in database
    const tenant = await tenants.create({
      name: "Acme Retail Corp",
      slug: `retail-${Date.now()}`,
    });
    console.log(`✅ [1/5] Tenant created: ${tenant.name} (${tenant.id})`);

    const wfRecord = await workflows.create({
      tenantId: tenant.id,
      key: orderWorkflow.id,
      name: orderWorkflow.name,
      metadata: orderWorkflow.metadata as any,
    });

    const verRecord = await versions.create({
      workflowId: wfRecord.id,
      version: orderWorkflow.version,
      definition: orderWorkflow.toMetadataPayload().version.definition as any,
      checksum: orderWorkflow.toMetadataPayload().version.checksum ?? "checksum",
      isActive: true,
    });
    console.log(`✅ [2/5] Workflow & Version registered: ${wfRecord.key} v${verRecord.version}`);

    // 2. Setup Worker and register SDK workflow definition
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

    orbit.registerInWorker(worker, orderWorkflow);
    console.log(`✅ [3/5] Registered "${orderWorkflow.id}" handler into Worker execution registry`);

    // 3. Dispatch a Workflow Run via Job queue
    const orderInput = {
      orderId: `ord_${Date.now()}`,
      customerId: "cust_alice_42",
      amount: 149.99,
      items: ["item_widget_a", "item_gadget_b"],
    };

    const createdRun = await runs.create({
      tenantId: tenant.id,
      workflowId: wfRecord.id,
      versionId: verRecord.id,
      input: orderInput,
      idempotencyKey: `req_${orderInput.orderId}`,
    });

    const job = await jobs.create({
      tenantId: tenant.id,
      queue: "default",
      type: "workflow.dispatch",
      payload: {
        workflowId: wfRecord.id,
        versionId: verRecord.id,
        runId: createdRun.id,
        input: orderInput,
      },
    });
    console.log(`✅ [4/5] Workflow run created (${createdRun.id}) and queued in Job queue (${job.id})`);

    // 4. Start Worker loop to claim and execute the job
    await worker.start();
    console.log(`⏳ Worker running: claiming and durably executing steps...`);

    const start = Date.now();
    let completed = false;
    while (!completed && Date.now() - start < 5000) {
      const currentJob = await jobs.findById(tenant.id, job.id);
      if (currentJob?.status === "COMPLETED") {
        completed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    await worker.stop();

    if (!completed) {
      throw new Error("Workflow execution timed out");
    }

    // 5. Inspect final run results and persisted steps
    const finalRun = await runs.findById(tenant.id, createdRun.id);
    const persistedSteps = await steps.listByRun(createdRun.id);

    console.log(`\n🎉 [5/5] Workflow Execution Completed Successfully!`);
    console.log(`-----------------------------------------------------`);
    console.log(`Run Status:  ${finalRun?.status}`);
    console.log(`Run Output:  `, JSON.stringify(finalRun?.output, null, 2));
    console.log(`Persisted Steps (${persistedSteps.length}):`);
    for (const s of persistedSteps) {
      console.log(`  - [${s.status}] Step: ${s.stepKey} (attempt ${s.attempt}) -> Output: ${JSON.stringify(s.output)}`);
    }
    console.log(`-----------------------------------------------------`);
  } finally {
    await disconnect(client);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("❌ [Orbit Example Failed]:", err);
    process.exit(1);
  });
}
