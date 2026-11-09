import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { ApiError } from "../errors/api-errors";
import {
  NotFoundError as StorageNotFoundError,
  ConflictError as StorageConflictError,
  StaleRevisionError,
} from "@durable/storage";
import { InvalidStateTransitionError } from "@durable/engine";
import type { AppEnv } from "../types";

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get("requestId") ?? "unknown";

  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }));
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details,
        },
      },
      400
    );
  }

  // 2. Custom API Errors
  if (err instanceof ApiError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details && { details: err.details }),
        },
      },
      err.statusCode as any
    );
  }

  // 3. Storage errors mapped to domain HTTP responses
  if (err instanceof StorageNotFoundError) {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: err.message,
        },
      },
      404
    );
  }

  if (err instanceof StorageConflictError) {
    return c.json(
      {
        error: {
          code: "CONFLICT",
          message: err.message,
        },
      },
      409
    );
  }

  if (err instanceof StaleRevisionError) {
    return c.json(
      {
        error: {
          code: "CONFLICT",
          message: "Resource was modified by another operation. Please retry with the latest revision.",
        },
      },
      409
    );
  }

  // 4. Engine State Machine errors
  if (err instanceof InvalidStateTransitionError) {
    return c.json(
      {
        error: {
          code: "CONFLICT",
          message: err.message,
        },
      },
      409
    );
  }

  // 5. Unhandled / Database / Internal errors
  // Security rule: Never expose database errors or internal stack traces to the caller
  if (process.env["NODE_ENV"] !== "test" || process.env["API_LOG"] === "true") {
    console.error(`[Unhandled Error] [req=${requestId}]`, err);
  }

  return c.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An internal server error occurred",
      },
    },
    500
  );
};
