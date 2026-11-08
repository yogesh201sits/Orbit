import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { ConnectionError } from "./errors/storage-errors";

export type DatabaseClient = PrismaClient;

let _client: PrismaClient | null = null;
let _pool: pg.Pool | null = null;

/**
 * Returns a singleton PrismaClient instance.
 * Requires DATABASE_URL environment variable.
 */
export function getClient(): PrismaClient {
  if (!_client) {
    const url = process.env["DATABASE_URL"];
    if (!url) {
      throw new ConnectionError(
        "DATABASE_URL environment variable is not set"
      );
    }
    _pool = new pg.Pool({ connectionString: url });
    const adapter = new PrismaPg(_pool);
    _client = new PrismaClient({
      adapter,
      log: process.env["PRISMA_LOG"] === "true"
        ? ["query", "info", "warn", "error"]
        : ["error"],
    });
  }
  return _client;
}

/**
 * Creates a fresh PrismaClient with an explicit connection URL.
 * Use for testing or when you need an isolated client.
 */
export function createClient(databaseUrl: string): PrismaClient {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool, { disposeExternalPool: true });
  return new PrismaClient({
    adapter,
    log: process.env["PRISMA_LOG"] === "true"
      ? ["query", "info", "warn", "error"]
      : ["error"],
  });
}

/**
 * Disconnects and nullifies the singleton client.
 */
export async function disconnectClient(): Promise<void> {
  if (_client) {
    await _client.$disconnect();
    _client = null;
  }
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

/**
 * Disconnects a specific client instance.
 */
export async function disconnect(client: PrismaClient): Promise<void> {
  await client.$disconnect();
}

/**
 * Health check — verifies the database is reachable.
 */
export async function healthCheck(
  client: PrismaClient
): Promise<boolean> {
  try {
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
