import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

export const loggerMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const start = performance.now();
  const method = c.req.method;
  const path = c.req.path;
  const requestId = c.get("requestId") ?? "unknown";

  await next();

  const duration = Math.round((performance.now() - start) * 100) / 100;
  const status = c.res.status;
  c.header("x-response-time", `${duration}ms`);

  // Structured logging without exposing sensitive data
  if (process.env["NODE_ENV"] !== "test" || process.env["API_LOG"] === "true") {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId,
        method,
        path,
        status,
        durationMs: duration,
      })
    );
  }
});
