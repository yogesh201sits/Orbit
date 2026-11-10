import { describe, test, expect, mock } from "bun:test";
import { HttpTransport } from "../../src/client/transport";
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  WorkflowNotFoundError,
  RunNotFoundError,
  IdempotencyConflictError,
  RateLimitError,
  RequestTimeoutError,
} from "../../src/errors/sdk-errors";

describe("HttpTransport", () => {
  const config = {
    apiKey: "test-api-key",
    baseUrl: "http://localhost:3000",
    timeoutMs: 5000,
    headers: { "X-Custom": "test-header" },
  };

  test("sets Authorization header and custom headers correctly", async () => {
    let capturedHeaders: Headers | undefined;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (url: any, init: any) => {
      capturedHeaders = new Headers(init.headers);
      return new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any;

    try {
      const transport = new HttpTransport(config);
      const res = await transport.request<{ ok: boolean }>("/v1/workflows");

      expect(res.data).toEqual({ ok: true });
      expect(capturedHeaders?.get("Authorization")).toBe("Bearer test-api-key");
      expect(capturedHeaders?.get("X-Custom")).toBe("test-header");
      expect(capturedHeaders?.get("Accept")).toBe("application/json");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("propagates Idempotency-Key header when provided", async () => {
    let capturedHeaders: Headers | undefined;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (url: any, init: any) => {
      capturedHeaders = new Headers(init.headers);
      return new Response(JSON.stringify({ data: { runId: "r1" } }), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "X-Idempotent-Replay": "true",
        },
      });
    }) as any;

    try {
      const transport = new HttpTransport(config);
      const res = await transport.request<{ runId: string }>("/v1/runs", {
        method: "POST",
        idempotencyKey: "idem_key_123",
      });

      expect(capturedHeaders?.get("Idempotency-Key")).toBe("idem_key_123");
      expect(res.isIdempotentReplay).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("maps 401 response to AuthenticationError", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({ error: { message: "Invalid API key" } }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }) as any;

    try {
      const transport = new HttpTransport(config);
      await expect(transport.request("/v1/runs")).rejects.toThrow(AuthenticationError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("maps 403 response to AuthorizationError", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({ error: { message: "Forbidden" } }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }) as any;

    try {
      const transport = new HttpTransport(config);
      await expect(transport.request("/v1/runs")).rejects.toThrow(AuthorizationError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("maps 400 response to ValidationError with details", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          error: {
            message: "Validation failed",
            details: [{ path: "name", message: "Required" }],
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }) as any;

    try {
      const transport = new HttpTransport(config);
      await expect(transport.request("/v1/workflows")).rejects.toThrow(ValidationError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("maps 404 to RunNotFoundError or WorkflowNotFoundError", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (url: any) => {
      return new Response(
        JSON.stringify({ error: { message: "Not found" } }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }) as any;

    try {
      const transport = new HttpTransport(config);
      await expect(transport.request("/v1/runs/run-999")).rejects.toThrow(RunNotFoundError);
      await expect(transport.request("/v1/workflows/wf-999")).rejects.toThrow(WorkflowNotFoundError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("maps 409 with idempotencyKey to IdempotencyConflictError", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({ error: { message: "Idempotency conflict" } }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }) as any;

    try {
      const transport = new HttpTransport(config);
      await expect(
        transport.request("/v1/runs", {
          method: "POST",
          idempotencyKey: "idem_conflict",
        })
      ).rejects.toThrow(IdempotencyConflictError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("maps 429 to RateLimitError", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({ error: { message: "Too many requests" } }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }) as any;

    try {
      const transport = new HttpTransport(config);
      await expect(transport.request("/v1/runs")).rejects.toThrow(RateLimitError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("times out when request exceeds configured timeoutMs", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (url: any, init: any) => {
      // Simulate slow response that respects AbortSignal
      return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve(new Response(JSON.stringify({ ok: true })));
        }, 500);

        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(init.signal.reason);
        });
      });
    }) as any;

    try {
      const transport = new HttpTransport({ ...config, timeoutMs: 50 });
      await expect(transport.request("/v1/slow")).rejects.toThrow(RequestTimeoutError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("never leaks apiKey in thrown errors", async () => {
    const secretKey = "orb_super_secret_dont_leak_me";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      throw new Error("Connection failed unexpectedly");
    }) as any;

    try {
      const transport = new HttpTransport({ ...config, apiKey: secretKey });
      try {
        await transport.request("/v1/fail");
      } catch (err: any) {
        expect(err.message).not.toContain(secretKey);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
