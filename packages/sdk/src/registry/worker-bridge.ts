import type { OrbitWorkflow } from "../workflow/types";

export interface RegisterableWorker {
  registerWorkflow(workflow: import("@durable/engine").WorkflowDefinition<any, any>, version?: number): void;
}

/**
 * Registers one or more Orbit SDK workflow definitions into an Orbit Worker.
 */
export function registerInWorker(
  worker: RegisterableWorker,
  workflows: OrbitWorkflow | OrbitWorkflow[]
): void {
  const items = Array.isArray(workflows) ? workflows : [workflows];
  for (const wf of items) {
    worker.registerWorkflow(wf.toEngineDefinition(), wf.version);
  }
}
