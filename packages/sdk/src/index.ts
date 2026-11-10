// Public entry point for @durable/sdk

export { Orbit } from "./client/orbit";
export type { OrbitConfig, ResolvedOrbitConfig } from "./client/config";

export { defineWorkflow } from "./workflow/workflow";
export type {
  OrbitWorkflow,
  WorkflowOptions,
  WorkflowHandler,
  WorkflowHandlerParams,
  WorkflowExecutionContext,
  StepContext,
  StepRunOptions,
  StepSleepOptions,
  WaitForEventOptions,
  EmitEventOptions,
  ChildWorkflowOptions,
  Duration,
} from "./workflow/types";

export { WorkflowRegistry } from "./registry/workflow-registry";
export { registerInWorker, type RegisterableWorker } from "./registry/worker-bridge";

// Management types
export type {
  WorkflowRecordDto,
  WorkflowVersionRecordDto,
  CreateWorkflowParams,
  UpdateWorkflowParams,
} from "./management/workflows";
export type {
  WorkflowRunRecordDto,
  WorkflowStepRecordDto,
  WorkflowEventRecordDto,
  CreateRunOptions,
  CreateRunResult,
  ListRunsFilter,
} from "./management/runs";
export type {
  ScheduleRecordDto,
  CreateScheduleParams,
  UpdateScheduleParams,
} from "./management/schedules";

// Errors
export {
  OrbitSDKError,
  ConfigurationError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  WorkflowNotFoundError,
  WorkflowVersionError,
  RunNotFoundError,
  StepExecutionError,
  StepTimeoutError,
  StepCancelledError,
  RequestTimeoutError,
  NetworkError,
  RateLimitError,
  IdempotencyConflictError,
} from "./errors/sdk-errors";
