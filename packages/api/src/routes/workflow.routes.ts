import { Hono } from "hono";
import { getTenantId } from "../middleware/tenant-context";
import {
  CreateWorkflowSchema,
  UpdateWorkflowSchema,
} from "../schemas/workflow.schema";
import {
  PaginationQuerySchema,
  WorkflowIdParamSchema,
} from "../schemas/common.schema";
import type { AppEnv } from "../types";

export function createWorkflowRoutes() {
  const router = new Hono<AppEnv>();

  // POST /v1/workflows
  router.post("/", async (c) => {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    const validatedDto = CreateWorkflowSchema.parse(body);

    const workflow = await c.get("services").workflow.createWorkflow(
      tenantId,
      validatedDto
    );

    return c.json({ data: workflow }, 201);
  });

  // GET /v1/workflows
  router.get("/", async (c) => {
    const tenantId = getTenantId(c);
    const query = PaginationQuerySchema.parse(c.req.query());

    const result = await c.get("services").workflow.listWorkflows(
      tenantId,
      query
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

  // GET /v1/workflows/:workflowId
  router.get("/:workflowId", async (c) => {
    const tenantId = getTenantId(c);
    const { workflowId } = WorkflowIdParamSchema.parse(c.req.param());

    const workflow = await c.get("services").workflow.getWorkflow(
      tenantId,
      workflowId
    );

    return c.json({ data: workflow });
  });

  // PATCH /v1/workflows/:workflowId
  router.patch("/:workflowId", async (c) => {
    const tenantId = getTenantId(c);
    const { workflowId } = WorkflowIdParamSchema.parse(c.req.param());
    const body = await c.req.json();
    const validatedDto = UpdateWorkflowSchema.parse(body);

    const updated = await c.get("services").workflow.updateWorkflow(
      tenantId,
      workflowId,
      validatedDto
    );

    return c.json({ data: updated });
  });

  // DELETE /v1/workflows/:workflowId
  router.delete("/:workflowId", async (c) => {
    const tenantId = getTenantId(c);
    const { workflowId } = WorkflowIdParamSchema.parse(c.req.param());

    await c.get("services").workflow.deleteWorkflow(tenantId, workflowId);

    return c.body(null, 204);
  });

  return router;
}
