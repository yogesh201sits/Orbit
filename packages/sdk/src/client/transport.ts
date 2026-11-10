import type { ResolvedOrbitConfig } from "./config";
import {
  OrbitSDKError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  WorkflowNotFoundError,
  RunNotFoundError,
  IdempotencyConflictError,
  RateLimitError,
  RequestTimeoutError,
  NetworkError,
} from "../errors/sdk-errors";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | undefined;
  headers?: Record<string, string> | undefined;
  body?: unknown | undefined;
  query?: Record<string, string | number | boolean | undefined> | undefined;
  signal?: AbortSignal | undefined;
  timeoutMs?: number | undefined;
  idempotencyKey?: string | undefined;
}

export interface HttpResponse<T> {
  data: T;
  status: number;
  headers: Headers;
  isIdempotentReplay?: boolean | undefined;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  } | undefined;
}

export class HttpTransport {
  constructor(private readonly config: ResolvedOrbitConfig) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    const url = new URL(path.startsWith("/") ? path : `/${path}`, this.config.baseUrl);

    if (options.query) {
      for (const [key, val] of Object.entries(options.query)) {
        if (val !== undefined) {
          url.searchParams.set(key, String(val));
        }
      }
    }

    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const timeoutController = new AbortController();
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

    if (timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        timeoutController.abort(new RequestTimeoutError(timeoutMs, url.pathname));
      }, timeoutMs);
    }

    // Link caller signal if provided
    const combinedController = new AbortController();
    const onCallerAbort = () => combinedController.abort(options.signal?.reason);
    const onTimeoutAbort = () => combinedController.abort(timeoutController.signal.reason);

    if (options.signal) {
      if (options.signal.aborted) {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        throw options.signal.reason;
      }
      options.signal.addEventListener("abort", onCallerAbort, { once: true });
    }
    timeoutController.signal.addEventListener("abort", onTimeoutAbort, { once: true });

    const headers: Record<string, string> = {
      "Accept": "application/json",
      "Authorization": `Bearer ${this.config.apiKey}`,
      ...this.config.headers,
      ...options.headers,
    };

    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }

    let requestBody: string | undefined = undefined;
    if (options.body !== undefined && options.body !== null) {
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(options.body);
    }

    try {
      const fetchOptions: RequestInit = {
        method: options.method ?? "GET",
        headers,
        signal: combinedController.signal,
      };
      if (requestBody !== undefined) {
        fetchOptions.body = requestBody;
      }

      const response = await fetch(url.toString(), fetchOptions);

      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (options.signal) {
        options.signal.removeEventListener("abort", onCallerAbort);
      }
      timeoutController.signal.removeEventListener("abort", onTimeoutAbort);

      const isReplay = response.headers.get("x-idempotent-replay") === "true";

      // 204 No Content
      if (response.status === 204) {
        return {
          data: undefined as unknown as T,
          status: 204,
          headers: response.headers,
          isIdempotentReplay: isReplay,
        };
      }

      const contentType = response.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");

      let json: any = null;
      if (isJson) {
        try {
          json = await response.json();
        } catch {
          json = null;
        }
      } else {
        const text = await response.text();
        if (text) {
          try {
            json = JSON.parse(text);
          } catch {
            json = { message: text };
          }
        }
      }

      if (!response.ok) {
        this.handleErrorResponse(response.status, json, url.pathname, options);
      }

      return {
        data: (json?.data !== undefined ? json.data : json) as T,
        status: response.status,
        headers: response.headers,
        isIdempotentReplay: isReplay || json?.isIdempotentReplay === true,
        pagination: json?.pagination,
      };
    } catch (err: unknown) {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (options.signal) {
        options.signal.removeEventListener("abort", onCallerAbort);
      }
      timeoutController.signal.removeEventListener("abort", onTimeoutAbort);

      if (err instanceof OrbitSDKError) {
        throw err;
      }

      if (combinedController.signal.aborted) {
        if (combinedController.signal.reason instanceof OrbitSDKError) {
          throw combinedController.signal.reason;
        }
        if (timeoutController.signal.aborted) {
          throw new RequestTimeoutError(timeoutMs, url.pathname);
        }
        throw combinedController.signal.reason;
      }

      throw new NetworkError(err instanceof Error ? err.message : String(err), err);
    }
  }

  private handleErrorResponse(
    status: number,
    json: any,
    pathname: string,
    options: RequestOptions
  ): never {
    const errorPayload = json?.error ?? json ?? {};
    const message = errorPayload.message ?? `HTTP ${status} error`;
    const code = errorPayload.code;
    const details = errorPayload.details;

    switch (status) {
      case 401:
        throw new AuthenticationError(message, details);
      case 403:
        throw new AuthorizationError(message, details);
      case 400: {
        const issues = Array.isArray(details)
          ? details.map((d: any) => `${d.path ?? ""}: ${d.message ?? ""}`.trim())
          : undefined;
        throw new ValidationError(message, issues);
      }
      case 404: {
        if (pathname.includes("/runs")) {
          throw new RunNotFoundError(pathname.split("/").pop() ?? "unknown");
        }
        if (pathname.includes("/workflows")) {
          throw new WorkflowNotFoundError(pathname.split("/").pop() ?? "unknown");
        }
        throw new OrbitSDKError(message, { statusCode: 404, code: code ?? "NOT_FOUND", details });
      }
      case 409: {
        if (options.idempotencyKey) {
          throw new IdempotencyConflictError(options.idempotencyKey, message);
        }
        throw new OrbitSDKError(message, { statusCode: 409, code: code ?? "CONFLICT", details });
      }
      case 429: {
        throw new RateLimitError(message);
      }
      default:
        throw new OrbitSDKError(message, { statusCode: status, code: code ?? "SERVER_ERROR", details });
    }
  }
}
