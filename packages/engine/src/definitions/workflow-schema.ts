import { z } from "zod";

export const retryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1, "maxAttempts must be at least 1").default(3),
  initialDelayMs: z.number().min(0, "initialDelayMs must be non-negative").default(1000),
  backoffMultiplier: z.number().min(1, "backoffMultiplier must be at least 1").default(2),
  maxDelayMs: z.number().min(0, "maxDelayMs must be non-negative").default(30000),
  jitter: z.boolean().default(true),
  isRetryable: z.function().args(z.unknown()).returns(z.boolean()).optional(),
});

export const stepDefinitionSchema = z.object({
  id: z
    .string()
    .min(1, "Step id cannot be empty")
    .max(255, "Step id must not exceed 255 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Step id must contain only alphanumeric characters, underscores, or dashes"),
  type: z.string().min(1).default("action"),
  retry: retryPolicySchema.partial().optional(),
  timeoutMs: z.number().positive("timeoutMs must be greater than 0").optional(),
  metadata: z.record(z.unknown()).optional(),
  execute: z.function(),
});

export const workflowDefinitionSchema = z
  .object({
    name: z
      .string()
      .min(1, "Workflow name cannot be empty")
      .max(255, "Workflow name must not exceed 255 characters")
      .regex(/^[a-zA-Z0-9_-]+$/, "Workflow name must contain only alphanumeric characters, underscores, or dashes"),
    version: z.number().int().positive("Workflow version must be a positive integer"),
    description: z.string().max(1000).optional(),
    metadata: z.record(z.unknown()).optional(),
    steps: z
      .array(stepDefinitionSchema)
      .optional(),
    handler: z.function().optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.steps && !val.handler) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Workflow "${val.name}" must specify either 'steps' or a 'handler' function`,
        path: ["steps"],
      });
      return;
    }

    if (val.steps) {
      if (val.steps.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Workflow "${val.name}" steps array cannot be empty`,
          path: ["steps"],
        });
        return;
      }

      const seenIds = new Set<string>();
      for (let i = 0; i < val.steps.length; i++) {
        const step = val.steps[i];
        if (!step) continue;
        if (seenIds.has(step.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate step id "${step.id}" detected in workflow "${val.name}"`,
            path: ["steps", i, "id"],
          });
        } else {
          seenIds.add(step.id);
        }
      }
    }
  });

export type ValidatedWorkflowInput = z.infer<typeof workflowDefinitionSchema>;
