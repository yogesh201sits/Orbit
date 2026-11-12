import { Hono } from "hono";
import { cors } from "hono/cors";
import type { PrismaClient } from "@durable/storage";
import {
  PrismaApiKeyRepository,
  PrismaTenantRepository,
  PrismaWorkflowRepository,
  PrismaWorkflowVersionRepository,
  PrismaWorkflowRunRepository,
  PrismaWorkflowStepRepository,
  PrismaWorkflowEventRepository,
  PrismaJobRepository,
  PrismaScheduleRepository,
} from "@durable/storage";
import { ExecutionEngine } from "@durable/engine";
import { requestIdMiddleware } from "./middleware/request-id";
import { loggerMiddleware } from "./middleware/logger";
import { errorHandler } from "./middleware/error-handler";
import { authenticationMiddleware } from "./middleware/authentication";
import { requireTenantContext, getTenantId } from "./middleware/tenant-context";

import { AuthService } from "./services/auth.service";
import { WorkflowService } from "./services/workflow.service";
import { VersionService } from "./services/version.service";
import { RunService } from "./services/run.service";
import { ScheduleService } from "./services/schedule.service";

import { createHealthRoutes } from "./routes/health.routes";
import { createWorkflowRoutes } from "./routes/workflow.routes";
import { createVersionRoutes } from "./routes/version.routes";
import { createRunRoutes } from "./routes/run.routes";
import { createScheduleRoutes } from "./routes/schedule.routes";
import { createAuthRoutes } from "./routes/auth.routes";

import type { AppEnv, ApiServices } from "./types";

export interface CreateAppOptions {
  readonly client: PrismaClient;
  readonly services?: Partial<ApiServices>;
  readonly engine?: ExecutionEngine;
}

export function buildServices(client: PrismaClient, engine?: ExecutionEngine): ApiServices {
  const apiKeyRepo = new PrismaApiKeyRepository(client);
  const tenantRepo = new PrismaTenantRepository(client);
  const workflowRepo = new PrismaWorkflowRepository(client);
  const versionRepo = new PrismaWorkflowVersionRepository(client);
  const runRepo = new PrismaWorkflowRunRepository(client);
  const stepRepo = new PrismaWorkflowStepRepository(client);
  const eventRepo = new PrismaWorkflowEventRepository(client);
  const jobRepo = new PrismaJobRepository(client);
  const scheduleRepo = new PrismaScheduleRepository(client);

  const auth = new AuthService(apiKeyRepo, tenantRepo);
  const workflow = new WorkflowService(workflowRepo);
  const version = new VersionService(workflowRepo, versionRepo);
  const run = new RunService(
    client,
    workflowRepo,
    versionRepo,
    runRepo,
    stepRepo,
    eventRepo,
    jobRepo,
    engine
  );
  const schedule = new ScheduleService(scheduleRepo, workflowRepo);

  return { auth, workflow, version, run, schedule };
}

export function createApp(options: CreateAppOptions): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  const services = {
    ...buildServices(options.client, options.engine),
    ...options.services,
  };

  // 1. Global Middleware
  app.use(
    "*",
    cors({
      origin: (origin) => origin || "*",
      allowHeaders: ["Authorization", "Content-Type", "x-api-key", "Idempotency-Key", "x-request-id"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["x-request-id", "x-idempotent-replay"],
      credentials: true,
    })
  );
  app.use("*", requestIdMiddleware);
  app.use("*", loggerMiddleware);

  // Inject services container into context
  app.use("*", async (c, next) => {
    c.set("services", services);
    await next();
  });

  // 2. Central Error Handler
  app.onError(errorHandler);

  // 3. Platform Health & Readiness Routes (Unauthenticated)
  app.route("/", createHealthRoutes(options.client));

  // 4. Authenticated API v1 Sub-app
  const v1 = new Hono<AppEnv>();
  v1.use("*", authenticationMiddleware({ required: true }));
  v1.use("*", requireTenantContext);

  // Mount API modules
  v1.route("/workflows", createWorkflowRoutes());
  v1.route("/workflows", createVersionRoutes());
  v1.route("/", createRunRoutes());
  v1.route("/schedules", createScheduleRoutes());
  v1.route("/auth", createAuthRoutes());

  // Platform Metrics
  v1.get("/metrics/overview", async (c) => {
    const tenantId = getTenantId(c);
    const runs = await options.client.workflowRun.findMany({
      where: { tenantId },
      select: { status: true, createdAt: true },
    });
    const totalRuns = runs.length;
    const successfulRuns = runs.filter((r) => r.status === "COMPLETED").length;
    const failedRuns = runs.filter((r) => r.status === "FAILED").length;
    const runningExecutions = runs.filter((r) => r.status === "RUNNING").length;
    const registeredWorkflows = await options.client.workflow.count({ where: { tenantId, deletedAt: null } });
    const activeWorkers = await options.client.worker.count({ where: { tenantId, status: "ACTIVE" } });
    const successRate = totalRuns > 0 ? Number(((successfulRuns / totalRuns) * 100).toFixed(1)) : 100;

    return c.json({
      data: {
        totalRuns,
        successfulRuns,
        failedRuns,
        runningExecutions,
        registeredWorkflows,
        activeWorkers,
        successRate,
        chartData: [
          { timestamp: "00:00", total: Math.floor(totalRuns * 0.3), success: Math.floor(successfulRuns * 0.3), failed: Math.floor(failedRuns * 0.3) },
          { timestamp: "06:00", total: Math.floor(totalRuns * 0.5), success: Math.floor(successfulRuns * 0.5), failed: Math.floor(failedRuns * 0.5) },
          { timestamp: "12:00", total: totalRuns, success: successfulRuns, failed: failedRuns },
        ],
      },
    });
  });

  // Fleet Workers
  v1.get("/workers", async (c) => {
    const tenantId = getTenantId(c);
    const workers = await options.client.worker.findMany({
      where: { tenantId },
      orderBy: { lastHeartbeat: "desc" },
    });
    return c.json({
      data: workers.map((w) => ({
        id: w.id,
        tenantId: w.tenantId,
        name: w.name,
        queues: w.queues,
        status: w.status.toLowerCase(),
        lastHeartbeat: w.lastHeartbeat?.toISOString() ?? null,
        metadata: w.metadata,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
    });
  });

  app.route("/v1", v1);

  return app;
}
