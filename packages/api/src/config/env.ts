import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().default("postgresql://postgres:1234@localhost:5432/orbit_test?schema=public"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type ApiEnv = z.infer<typeof EnvSchema>;

export function loadConfig(overrides?: Partial<ApiEnv>): ApiEnv {
  return EnvSchema.parse({
    PORT: process.env["PORT"],
    HOST: process.env["HOST"],
    DATABASE_URL: process.env["DATABASE_URL"],
    NODE_ENV: process.env["NODE_ENV"],
    LOG_LEVEL: process.env["LOG_LEVEL"],
    ...overrides,
  });
}
