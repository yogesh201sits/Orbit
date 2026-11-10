import type { OrbitWorkflow } from "../workflow/types";
import { WorkflowVersionError, ValidationError } from "../errors/sdk-errors";

export class WorkflowRegistry {
  private readonly workflows = new Map<string, OrbitWorkflow>();

  private key(id: string, version?: number): string {
    return version !== undefined ? `${id}:${version}` : id;
  }

  /**
   * Registers an OrbitWorkflow definition into this registry.
   * Throws ValidationError if a contradictory definition already exists for the same ID and version.
   */
  register(workflow: OrbitWorkflow): void {
    if (!workflow || !workflow.id || !workflow.version) {
      throw new ValidationError("Cannot register invalid workflow definition");
    }

    const versionKey = this.key(workflow.id, workflow.version);
    const existing = this.workflows.get(versionKey);

    if (existing) {
      // If already registered, ensure definitions match
      if (existing !== workflow && existing.name !== workflow.name) {
        throw new ValidationError(
          `Conflict: Workflow "${workflow.id}" version ${workflow.version} is already registered with a different definition.`
        );
      }
      return;
    }

    this.workflows.set(versionKey, workflow);
    // Also store by id (representing latest/default registered version)
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * Retrieves a registered workflow by id and optional version.
   */
  get(id: string, version?: number): OrbitWorkflow | undefined {
    if (version !== undefined) {
      return this.workflows.get(this.key(id, version));
    }
    return this.workflows.get(id);
  }

  /**
   * Asserts that a workflow is registered, throwing WorkflowVersionError if missing.
   */
  getOrThrow(id: string, version?: number): OrbitWorkflow {
    const wf = this.get(id, version);
    if (!wf) {
      throw new WorkflowVersionError(id, version);
    }
    return wf;
  }

  /**
   * Checks whether a workflow is registered.
   */
  has(id: string, version?: number): boolean {
    if (version !== undefined) {
      return this.workflows.has(this.key(id, version));
    }
    return this.workflows.has(id);
  }

  /**
   * Returns all uniquely registered workflows.
   */
  list(): OrbitWorkflow[] {
    const unique = new Set<OrbitWorkflow>();
    for (const wf of this.workflows.values()) {
      unique.add(wf);
    }
    return Array.from(unique);
  }

  /**
   * Clears all registered workflows.
   */
  clear(): void {
    this.workflows.clear();
  }
}
