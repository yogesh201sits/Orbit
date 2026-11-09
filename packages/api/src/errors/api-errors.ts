export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_SERVER_ERROR"
  | "SERVICE_UNAVAILABLE";

export interface ApiErrorDetail {
  readonly path?: string;
  readonly message: string;
  readonly code?: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly details?: readonly ApiErrorDetail[] | undefined;

  constructor(
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    details?: readonly ApiErrorDetail[] | undefined
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, details?: readonly ApiErrorDetail[]) {
    super(400, "BAD_REQUEST", message, details);
    this.name = "BadRequestError";
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: readonly ApiErrorDetail[]) {
    super(400, "VALIDATION_ERROR", message, details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Authentication required") {
    super(401, "UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Access denied") {
    super(403, "FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, identifier?: string) {
    super(
      404,
      "NOT_FOUND",
      identifier
        ? `${resource} "${identifier}" not found`
        : `${resource} not found`
    );
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
    this.name = "ConflictError";
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message = "Service unavailable") {
    super(503, "SERVICE_UNAVAILABLE", message);
    this.name = "ServiceUnavailableError";
  }
}

export class InternalServerError extends ApiError {
  constructor(message = "Internal server error") {
    super(500, "INTERNAL_SERVER_ERROR", message);
    this.name = "InternalServerError";
  }
}
