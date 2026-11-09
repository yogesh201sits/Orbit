import { z } from "zod";

const MissedExecutionPolicyEnum = z.enum(["SKIP", "CATCH_UP", "LATEST"]);
const ScheduleStatusEnum = z.enum(["ACTIVE", "PAUSED", "CANCELLED"]);

export const CreateScheduleSchema = z.object({
  workflowId: z.string().uuid("Invalid workflowId UUID format"),
  cronExpression: z.string().min(1).optional(),
  timezone: z.string().default("UTC"),
  runAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  delayMs: z.number().int().positive().optional(),
  input: z.unknown().optional(),
  missedExecutionPolicy: MissedExecutionPolicyEnum.optional().default("SKIP"),
});

export type CreateScheduleDto = z.infer<typeof CreateScheduleSchema>;

export const UpdateScheduleSchema = z.object({
  cronExpression: z.string().min(1).optional(),
  timezone: z.string().optional(),
  input: z.unknown().optional(),
  missedExecutionPolicy: MissedExecutionPolicyEnum.optional(),
  status: ScheduleStatusEnum.optional(),
});

export type UpdateScheduleDto = z.infer<typeof UpdateScheduleSchema>;
