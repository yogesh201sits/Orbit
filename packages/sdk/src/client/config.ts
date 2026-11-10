import { ConfigurationError } from "../errors/sdk-errors";

export interface OrbitConfig {
  /**
   * Orbit API Key for tenant authentication.
   * Can also be supplied via `process.env.ORBIT_API_KEY`.
   */
  readonly apiKey?: string | undefined;

  /**
   * Base URL of the Orbit Control Plane API.
   * Defaults to `process.env.ORBIT_API_URL` or "http://localhost:3000".
   */
  readonly baseUrl?: string | undefined;

  /**
   * Default timeout in milliseconds for HTTP requests to the Orbit API.
   * Defaults to 30,000ms (30 seconds).
   */
  readonly timeoutMs?: number | undefined;

  /**
   * Optional custom HTTP headers sent with every request.
   */
  readonly headers?: Record<string, string> | undefined;
}

export interface ResolvedOrbitConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly headers: Record<string, string>;
}

/**
 * Validates and normalizes Orbit SDK configuration.
 * Ensures the API key is present and well-formed.
 */
export function resolveConfig(options?: OrbitConfig): ResolvedOrbitConfig {
  const apiKey =
    options?.apiKey ??
    (typeof process !== "undefined" ? process.env?.["ORBIT_API_KEY"] : undefined);

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new ConfigurationError(
      "Missing Orbit API key. Pass `apiKey` to Orbit constructor or set the ORBIT_API_KEY environment variable."
    );
  }

  let envUrl = typeof process !== "undefined" ? process.env?.["ORBIT_API_URL"] : undefined;
  if (envUrl === "undefined" || envUrl === "") {
    envUrl = undefined;
  }

  let baseUrl = options?.baseUrl ?? envUrl ?? "http://localhost:3000";

  // Normalize baseUrl by stripping trailing slashes
  baseUrl = baseUrl.trim().replace(/\/+$/, "");

  try {
    new URL(baseUrl);
  } catch {
    throw new ConfigurationError(`Invalid Orbit baseUrl: "${baseUrl}" is not a valid URL.`);
  }

  const timeoutMs = options?.timeoutMs ?? 30_000;
  if (typeof timeoutMs !== "number" || timeoutMs <= 0 || isNaN(timeoutMs)) {
    throw new ConfigurationError("Orbit `timeoutMs` must be a positive number.");
  }

  return {
    apiKey: apiKey.trim(),
    baseUrl,
    timeoutMs,
    headers: options?.headers ?? {},
  };
}

/**
 * Returns a redacted representation of sensitive strings (e.g. for debug logs).
 */
export function redactSecret(secret?: string | null): string {
  if (!secret) return "";
  if (secret.length <= 8) return "***";
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}
