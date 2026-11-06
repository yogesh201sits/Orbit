// ─── Client ──────────────────────────────────────────────────────────
export { PrismaClient } from "@prisma/client";
export {
  getClient,
  createClient,
  disconnectClient,
  disconnect,
  healthCheck,
} from "./client";
export type { DatabaseClient } from "./client";

// ─── Repositories ────────────────────────────────────────────────────
export * from "./repositories/index";

// ─── Errors ──────────────────────────────────────────────────────────
export * from "./errors/index";
