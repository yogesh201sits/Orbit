import { z } from "zod";

const RunStatusEnum = z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]);

export const CreateRunSchema = z.object({
  versionId: z.string().uuid("Invalid versionId UUID format").optional(),
  input: z.unknown().optional(),
});

export type CreateRunDto = z.infer<typeof CreateRunSchema>;

export const ListRunsQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((val) => (val ? val.toUpperCase() : undefined))
    .pipe(RunStatusEnum.optional()),
  workflowId: z.string().uuid("Invalid workflowId UUID format").optional(),
  from: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  to: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().min(1).max(100)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0))
    .pipe(z.number().min(0)),
});

export type ListRunsQuery = z.infer<typeof ListRunsQuerySchema>;
