import type { ApiKeyRecord } from "@durable/storage";
import type { AuthService } from "./services/auth.service";
import type { WorkflowService } from "./services/workflow.service";
import type { VersionService } from "./services/version.service";
import type { RunService } from "./services/run.service";
import type { ScheduleService } from "./services/schedule.service";

export interface ApiServices {
  readonly auth: AuthService;
  readonly workflow: WorkflowService;
  readonly version: VersionService;
  readonly run: RunService;
  readonly schedule: ScheduleService;
}

export type AppVariables = {
  requestId: string;
  tenantId?: string;
  apiKey?: ApiKeyRecord;
  clerkAuth?: any;
  services: ApiServices;
};

export type AppBindings = {};

export interface AppEnv {
  Variables: AppVariables;
  Bindings: AppBindings;
}
