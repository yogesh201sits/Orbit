import { z } from "zod";

export const CreateVersionSchema = z.object({
  version: z.number().int().min(1, "Version number must be an integer greater than or equal to 1"),
  definition: z.record(z.unknown()).refine(
    (def) => typeof def === "object" && def !== null,
    "Workflow definition must be a valid JSON object"
  ),
  checksum: z.string().max(64).optional(),
  isActive: z.boolean().optional().default(false),
});

export type CreateVersionDto = z.infer<typeof CreateVersionSchema>;
