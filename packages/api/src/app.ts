import { Hono } from "hono";
import type { PrismaClient } from "@durable/storage";
import {
  PrismaApiKeyRepository,
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
import { requireTenantContext } from "./middleware/tenant-context";

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
  const workflowRepo = new PrismaWorkflowRepository(client);
  const versionRepo = new PrismaWorkflowVersionRepository(client);
  const runRepo = new PrismaWorkflowRunRepository(client);
  const stepRepo = new PrismaWorkflowStepRepository(client);
  const eventRepo = new PrismaWorkflowEventRepository(client);
  const jobRepo = new PrismaJobRepository(client);
  const scheduleRepo = new PrismaScheduleRepository(client);

  const auth = new AuthService(apiKeyRepo);
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

  app.route("/v1", v1);

  return app;
}
