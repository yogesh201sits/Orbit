import { WorkflowValidationError } from "../errors/engine-errors";
import type { StepDefinition, WorkflowDefinition } from "./types";
import { workflowDefinitionSchema } from "./workflow-schema";

export function defineWorkflow<
  TWorkflowInput = any,
  const TSteps extends readonly StepDefinition<TWorkflowInput, any>[] = readonly StepDefinition<
    TWorkflowInput,
    any
  >[]
>(definition: WorkflowDefinition<TWorkflowInput, TSteps>): WorkflowDefinition<TWorkflowInput, TSteps> {
  const result = workflowDefinitionSchema.safeParse(definition);

  if (!result.success) {
    const errorMessages = result.error.errors.map(
      (err) => `${err.path.join(".")}: ${err.message}`
    );
    throw new WorkflowValidationError(
      `Invalid workflow definition "${definition?.name ?? "unknown"}":\n - ${errorMessages.join("\n - ")}`,
      errorMessages
    );
  }

  return Object.freeze({
    ...definition,
    ...(definition.steps ? { steps: Object.freeze([...definition.steps]) as unknown as TSteps } : {}),
  });
}
