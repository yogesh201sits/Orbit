import { createMiddleware } from "hono/factory";
import { randomUUID } from "node:crypto";
import type { AppEnv } from "../types";

export const requestIdMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const incomingId = c.req.header("x-request-id");
  const requestId = incomingId && incomingId.trim().length > 0 ? incomingId.trim() : randomUUID();

  c.set("requestId", requestId);
  c.header("x-request-id", requestId);

  await next();
});
