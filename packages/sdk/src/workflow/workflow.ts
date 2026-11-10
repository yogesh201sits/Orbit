import { createHash } from "node:crypto";
import { z } from "zod";
import type { WorkflowDefinition } from "@durable/engine";
import { ValidationError } from "../errors/sdk-errors";
import type {
  WorkflowOptions,
  WorkflowHandler,
  OrbitWorkflow,
  StepContext,
  WorkflowExecutionContext,
} from "./types";
import { createStepContext } from "../execution/step-context";

const workflowOptionsSchema = z.object({
  id: z
    .string()
    .min(1, "Workflow id cannot be empty")
    .max(255, "Workflow id must not exceed 255 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Workflow id must contain only alphanumeric characters, underscores, or dashes"),
  version: z
    .number()
    .int("Workflow version must be an integer")
    .min(1, "Workflow version must be at least 1"),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export class WorkflowImpl<TInput = any, TOutput = any> implements OrbitWorkflow<TInput, TOutput> {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly description?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly inputSchema?: z.ZodType<TInput> | undefined;
  readonly outputSchema?: z.ZodType<TOutput> | undefined;
  readonly handler: WorkflowHandler<TInput, TOutput>;

  private readonly _checksum: string;

  constructor(
    options: WorkflowOptions<TInput, TOutput>,
    handler: WorkflowHandler<TInput, TOutput>
  ) {
    if (typeof handler !== "function") {
      throw new ValidationError(`Workflow "${options?.id ?? "unknown"}" must provide an async handler function`);
    }

    const parseResult = workflowOptionsSchema.safeParse(options);
    if (!parseResult.success) {
      const issues = parseResult.error.errors.map(
        (err: z.ZodIssue) => `${err.path.join(".")}: ${err.message}`
      );
      throw new ValidationError(
        `Invalid workflow configuration for "${options?.id ?? "unknown"}":\n - ${issues.join("\n - ")}`,
        issues
      );
    }

    this.id = parseResult.data.id;
    this.version = parseResult.data.version;
    this.name = parseResult.data.name ?? parseResult.data.id;
    this.description = parseResult.data.description;
    this.metadata = parseResult.data.metadata;
    this.inputSchema = options.inputSchema;
    this.outputSchema = options.outputSchema;
    this.handler = handler;

    // Compute deterministic checksum of metadata
    const metadataString = JSON.stringify({
      id: this.id,
      version: this.version,
      name: this.name,
      description: this.description ?? null,
      metadata: this.metadata ?? null,
    });
    this._checksum = createHash("sha256").update(metadataString).digest("hex");

    Object.freeze(this);
  }

  toEngineDefinition(): WorkflowDefinition<TInput, any> {
    const self = this;

    return Object.freeze({
      name: this.id,
      version: this.version,
      description: this.description,
      metadata: this.metadata,
      handler: async (engineCtx: any): Promise<TOutput> => {
        let input = engineCtx.input as TInput;

        // Runtime input validation if schema provided
        if (self.inputSchema) {
          const validated = self.inputSchema.safeParse(input);
          if (!validated.success) {
            const issues = validated.error.errors.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`);
            throw new ValidationError(
              `Workflow "${self.id}" input validation failed:\n - ${issues.join("\n - ")}`,
              issues
            );
          }
          input = validated.data;
        }

        const tenantId = engineCtx.context?.tenantId ?? "default";
        const workflowId = self.id;
        const runId = engineCtx.context?.runId ?? "unknown";
        const signal = engineCtx.context?.signal ?? new AbortController().signal;

        // Canonical external side-effect idempotency key: tenantId:workflowId:runId:stepId
        const stepContext = createStepContext({
          tenantId,
          workflowId,
          runId,
          signal,
          engineStep: engineCtx.step,
          logger: engineCtx.context?.logger,
        });

        const executionContext: WorkflowExecutionContext = {
          tenantId,
          workflowId,
          runId,
          attempt: 1,
          signal,
          idempotencyKey: `${tenantId}:${workflowId}:${runId}`,
        };

        const result = await self.handler({
          input,
          step: stepContext,
          context: executionContext,
        });

        // Runtime output validation if schema provided
        if (self.outputSchema) {
          const validatedOut = self.outputSchema.safeParse(result);
          if (!validatedOut.success) {
            const issues = validatedOut.error.errors.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`);
            throw new ValidationError(
              `Workflow "${self.id}" output validation failed:\n - ${issues.join("\n - ")}`,
              issues
            );
          }
          return validatedOut.data;
        }

        return result;
      },
    });
  }

  toMetadataPayload() {
    return {
      key: this.id,
      name: this.name,
      metadata: this.metadata,
      version: {
        version: this.version,
        definition: {
          id: this.id,
          version: this.version,
          name: this.name,
          description: this.description,
          metadata: this.metadata,
        },
        checksum: this._checksum,
        isActive: true,
      },
    };
  }
}

/**
 * Defines a durable function-first workflow with automatic Zod input/output schema inference.
 */
export function defineWorkflow<
  TInputSchema extends z.ZodType<any>,
  TOutputSchema extends z.ZodType<any> = z.ZodType<any>,
  TInput = z.infer<TInputSchema>,
  TOutput = z.infer<TOutputSchema>
>(
  options: WorkflowOptions<TInput, TOutput, TInputSchema, TOutputSchema> & { inputSchema: TInputSchema },
  handler: WorkflowHandler<TInput, TOutput>
): OrbitWorkflow<TInput, TOutput>;
export function defineWorkflow<
  TInput = any,
  TOutput = any
>(
  options: WorkflowOptions<TInput, TOutput>,
  handler: WorkflowHandler<TInput, TOutput>
): OrbitWorkflow<TInput, TOutput>;
export function defineWorkflow(options: any, handler: any): OrbitWorkflow<any, any> {
  return new WorkflowImpl(options, handler);
}
