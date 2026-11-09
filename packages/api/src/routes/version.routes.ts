import { Hono } from "hono";
import { getTenantId } from "../middleware/tenant-context";
import { CreateVersionSchema } from "../schemas/version.schema";
import {
  PaginationQuerySchema,
  WorkflowIdParamSchema,
  VersionIdParamSchema,
} from "../schemas/common.schema";
import type { AppEnv } from "../types";

export function createVersionRoutes() {
  const router = new Hono<AppEnv>();

  // POST /v1/workflows/:workflowId/versions
  router.post("/:workflowId/versions", async (c) => {
    const tenantId = getTenantId(c);
    const { workflowId } = WorkflowIdParamSchema.parse(c.req.param());
    const body = await c.req.json();
    const validatedDto = CreateVersionSchema.parse(body);

    const version = await c.get("services").version.createVersion(
      tenantId,
      workflowId,
      validatedDto
    );

    return c.json({ data: version }, 201);
  });

  // GET /v1/workflows/:workflowId/versions
  router.get("/:workflowId/versions", async (c) => {
    const tenantId = getTenantId(c);
    const { workflowId } = WorkflowIdParamSchema.parse(c.req.param());
    const query = PaginationQuerySchema.parse(c.req.query());

    const result = await c.get("services").version.listVersions(
      tenantId,
      workflowId,
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

  // POST /v1/workflows/:workflowId/versions/:versionId/activate
  router.post("/:workflowId/versions/:versionId/activate", async (c) => {
    const tenantId = getTenantId(c);
    const { workflowId, versionId } = VersionIdParamSchema.parse(c.req.param());

    const activated = await c.get("services").version.activateVersion(
      tenantId,
      workflowId,
      versionId
    );

    return c.json({ data: activated });
  });

  return router;
}
