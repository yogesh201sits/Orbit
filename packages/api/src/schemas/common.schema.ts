import { z } from "zod";

export const PaginationQuerySchema = z.object({
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

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const IdParamSchema = z.object({
  id: z.string().uuid("Invalid UUID format"),
});

export const WorkflowIdParamSchema = z.object({
  workflowId: z.string().uuid("Invalid workflowId UUID format"),
});

export const VersionIdParamSchema = z.object({
  workflowId: z.string().uuid("Invalid workflowId UUID format"),
  versionId: z.string().uuid("Invalid versionId UUID format"),
});

export const RunIdParamSchema = z.object({
  runId: z.string().uuid("Invalid runId UUID format"),
});

export const ScheduleIdParamSchema = z.object({
  scheduleId: z.string().uuid("Invalid scheduleId UUID format"),
});
