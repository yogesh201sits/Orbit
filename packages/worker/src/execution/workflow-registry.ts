import type { WorkflowDefinition } from "@durable/engine";
import type { JobHandler } from "../types";

export class WorkflowRegistry {
  private readonly workflows = new Map<string, WorkflowDefinition<any, any>>();
  private readonly handlers = new Map<string, JobHandler>();

  /**
   * Registers a workflow definition by its name.
   */
  registerWorkflow(workflow: WorkflowDefinition<any, any>): void {
    this.workflows.set(workflow.name, workflow);
  }

  /**
   * Retrieves a registered workflow definition by name or key.
   */
  getWorkflow(name: string): WorkflowDefinition<any, any> | undefined {
    return this.workflows.get(name);
  }

  /**
   * Checks if a workflow is registered.
   */
  hasWorkflow(name: string): boolean {
    return this.workflows.has(name);
  }

  /**
   * Registers a custom job handler for a specific job type.
   */
  registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Retrieves a registered custom handler.
   */
  getHandler(type: string): JobHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Clears all registered workflows and handlers.
   */
  clear(): void {
    this.workflows.clear();
    this.handlers.clear();
  }
}
