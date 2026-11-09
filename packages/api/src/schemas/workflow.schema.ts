import { z } from "zod";

export const CreateWorkflowSchema = z.object({
  key: z
    .string()
    .min(1, "Workflow key cannot be empty")
    .max(255, "Workflow key cannot exceed 255 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Workflow key can only contain alphanumeric characters, hyphens, and underscores"),
  name: z
    .string()
    .min(1, "Workflow name cannot be empty")
    .max(255, "Workflow name cannot exceed 255 characters"),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateWorkflowDto = z.infer<typeof CreateWorkflowSchema>;

export const UpdateWorkflowSchema = z.object({
  name: z
    .string()
    .min(1, "Workflow name cannot be empty")
    .max(255, "Workflow name cannot exceed 255 characters")
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateWorkflowDto = z.infer<typeof UpdateWorkflowSchema>;
