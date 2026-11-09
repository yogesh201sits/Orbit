import { Hono } from "hono";
import { getTenantId } from "../middleware/tenant-context";
import {
  CreateRunSchema,
  ListRunsQuerySchema,
} from "../schemas/run.schema";
import {
  WorkflowIdParamSchema,
  RunIdParamSchema,
} from "../schemas/common.schema";
import type { AppEnv } from "../types";

export function createRunRoutes() {
  const router = new Hono<AppEnv>();

  // POST /workflows/:workflowId/runs -> /v1/workflows/:workflowId/runs
  router.post("/workflows/:workflowId/runs", async (c) => {
    const tenantId = getTenantId(c);
    const { workflowId } = WorkflowIdParamSchema.parse(c.req.param());
    const idempotencyKey = c.req.header("idempotency-key") ?? null;

    let body = {};
    const text = await c.req.text();
    if (text && text.trim().length > 0) {
      body = JSON.parse(text);
    }
    const validatedDto = CreateRunSchema.parse(body);

    const result = await c.get("services").run.createRun(
      tenantId,
      workflowId,
      validatedDto,
      idempotencyKey
    );

    const statusCode = result.isIdempotentReplay ? 200 : 201;
    if (result.isIdempotentReplay) {
      c.header("x-idempotent-replay", "true");
    }

    return c.json(
      {
        data: result.run,
        isIdempotentReplay: result.isIdempotentReplay,
      },
      statusCode
    );
  });

  // GET /runs -> /v1/runs
  router.get("/runs", async (c) => {
    const tenantId = getTenantId(c);
    const query = ListRunsQuerySchema.parse(c.req.query());

    const result = await c.get("services").run.listRuns(
      tenantId,
      {
        status: query.status as any,
        workflowId: query.workflowId,
        from: query.from,
        to: query.to,
      },
      {
        limit: query.limit,
        offset: query.offset,
      }
    );

    return c.json({
      data: result.data,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    });
  });

  // GET /runs/:runId -> /v1/runs/:runId
  router.get("/runs/:runId", async (c) => {
    const tenantId = getTenantId(c);
    const { runId } = RunIdParamSchema.parse(c.req.param());

    const run = await c.get("services").run.getRun(tenantId, runId);

    return c.json({ data: run });
  });

  // POST /runs/:runId/cancel -> /v1/runs/:runId/cancel
  router.post("/runs/:runId/cancel", async (c) => {
    const tenantId = getTenantId(c);
    const { runId } = RunIdParamSchema.parse(c.req.param());

    const cancelledRun = await c.get("services").run.cancelRun(tenantId, runId);

    return c.json({ data: cancelledRun });
  });

  // POST /runs/:runId/retry -> /v1/runs/:runId/retry
  router.post("/runs/:runId/retry", async (c) => {
    const tenantId = getTenantId(c);
    const { runId } = RunIdParamSchema.parse(c.req.param());

    const retriedRun = await c.get("services").run.retryRun(tenantId, runId);

    return c.json({ data: retriedRun });
  });

  // GET /runs/:runId/steps -> /v1/runs/:runId/steps
  router.get("/runs/:runId/steps", async (c) => {
    const tenantId = getTenantId(c);
    const { runId } = RunIdParamSchema.parse(c.req.param());

    const steps = await c.get("services").run.getRunSteps(tenantId, runId);

    return c.json({ data: steps });
  });

  // GET /runs/:runId/events -> /v1/runs/:runId/events
  router.get("/runs/:runId/events", async (c) => {
    const tenantId = getTenantId(c);
    const { runId } = RunIdParamSchema.parse(c.req.param());

    const events = await c.get("services").run.getRunEvents(tenantId, runId);

    return c.json({ data: events });
  });

  return router;
}
