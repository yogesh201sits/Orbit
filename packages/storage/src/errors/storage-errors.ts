/**
 * Base error for all storage-layer errors.
 */
export class StorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StorageError";
  }
}

/**
 * Thrown when a requested entity does not exist.
 */
export class NotFoundError extends StorageError {
  public readonly entity: string;
  public readonly id: string;

  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = "NotFoundError";
    this.entity = entity;
    this.id = id;
  }
}

/**
 * Thrown when a unique constraint is violated (duplicate key, etc.).
 */
export class ConflictError extends StorageError {
  public readonly constraint: string;

  constructor(message: string, constraint: string) {
    super(message);
    this.name = "ConflictError";
    this.constraint = constraint;
  }
}

/**
 * Thrown when an optimistic concurrency check fails.
 * The caller supplied a stale revision number.
 */
export class StaleRevisionError extends StorageError {
  public readonly entity: string;
  public readonly id: string;
  public readonly expectedRevision: number;

  constructor(entity: string, id: string, expectedRevision: number) {
    super(
      `Stale revision for ${entity} ${id}: expected revision ${expectedRevision}`
    );
    this.name = "StaleRevisionError";
    this.entity = entity;
    this.id = id;
    this.expectedRevision = expectedRevision;
  }
}

/**
 * Thrown when a database connection fails.
 */
export class ConnectionError extends StorageError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ConnectionError";
  }
}

/**
 * Thrown when a transaction fails.
 */
export class TransactionError extends StorageError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TransactionError";
  }
}
