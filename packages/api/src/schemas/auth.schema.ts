import { z } from "zod";

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  expiresAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

export type CreateApiKeyDto = z.infer<typeof CreateApiKeySchema>;
