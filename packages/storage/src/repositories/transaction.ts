import type { PrismaClient } from "../generated/prisma/client";
import type { TransactionClient } from "./interfaces";
import { TransactionError } from "../errors/storage-errors";

/**
 * Executes a function within a Prisma interactive transaction.
 *
 * @param client - PrismaClient instance.
 * @param fn - Function receiving a transaction client.
 * @param options - Transaction options (timeout, isolation level).
 * @returns The result of the callback.
 * @throws TransactionError on failure.
 */
export async function withTransaction<T>(
  client: PrismaClient,
  fn: (tx: TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
  }
): Promise<T> {
  try {
    return await client.$transaction(fn, {
      maxWait: options?.maxWait ?? 5000,
      timeout: options?.timeout ?? 10000,
    });
  } catch (e) {
    if (e instanceof TransactionError) {
      throw e;
    }
    throw new TransactionError(
      `Transaction failed: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e }
    );
  }
}
