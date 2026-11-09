import { Hono } from "hono";
import { getTenantId } from "../middleware/tenant-context";
import {
  CreateScheduleSchema,
  UpdateScheduleSchema,
} from "../schemas/schedule.schema";
import {
  PaginationQuerySchema,
  ScheduleIdParamSchema,
} from "../schemas/common.schema";
import type { AppEnv } from "../types";

export function createScheduleRoutes() {
  const router = new Hono<AppEnv>();

  // POST /v1/schedules
  router.post("/", async (c) => {
    const tenantId = getTenantId(c);
    const body = await c.req.json();
    const validatedDto = CreateScheduleSchema.parse(body);

    const schedule = await c.get("services").schedule.createSchedule(
      tenantId,
      validatedDto
    );

    return c.json({ data: schedule }, 201);
  });

  // GET /v1/schedules
  router.get("/", async (c) => {
    const tenantId = getTenantId(c);
    const query = PaginationQuerySchema.parse(c.req.query());

    const result = await c.get("services").schedule.listSchedules(
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

  // GET /v1/schedules/:scheduleId
  router.get("/:scheduleId", async (c) => {
    const tenantId = getTenantId(c);
    const { scheduleId } = ScheduleIdParamSchema.parse(c.req.param());

    const schedule = await c.get("services").schedule.getSchedule(
      tenantId,
      scheduleId
    );

    return c.json({ data: schedule });
  });

  // PATCH /v1/schedules/:scheduleId
  router.patch("/:scheduleId", async (c) => {
    const tenantId = getTenantId(c);
    const { scheduleId } = ScheduleIdParamSchema.parse(c.req.param());
    const body = await c.req.json();
    const validatedDto = UpdateScheduleSchema.parse(body);

    const updated = await c.get("services").schedule.updateSchedule(
      tenantId,
      scheduleId,
      validatedDto
    );

    return c.json({ data: updated });
  });

  // DELETE /v1/schedules/:scheduleId
  router.delete("/:scheduleId", async (c) => {
    const tenantId = getTenantId(c);
    const { scheduleId } = ScheduleIdParamSchema.parse(c.req.param());

    const cancelled = await c.get("services").schedule.deleteSchedule(
      tenantId,
      scheduleId
    );

    return c.json({ data: cancelled });
  });

  return router;
}
