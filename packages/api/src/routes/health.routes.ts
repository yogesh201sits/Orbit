import { Hono } from "hono";
import { healthCheck, type PrismaClient } from "@durable/storage";
import type { AppEnv } from "../types";

export function createHealthRoutes(client?: PrismaClient) {
  const router = new Hono<AppEnv>();

  router.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/ready", async (c) => {
    if (!client) {
      return c.json({
        status: "ready",
        database: "unconfigured",
        timestamp: new Date().toISOString(),
      });
    }

    const isHealthy = await healthCheck(client);
    if (!isHealthy) {
      return c.json(
        {
          status: "unhealthy",
          database: false,
          timestamp: new Date().toISOString(),
        },
        503
      );
    }

    return c.json({
      status: "ready",
      database: true,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
