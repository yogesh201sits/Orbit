import type { RetryPolicy } from "../definitions/types";
import { WorkflowCancelledError } from "../errors/engine-errors";

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  jitter: true,
};

export function resolveRetryPolicy(custom?: Partial<RetryPolicy> | undefined): RetryPolicy {
  const policy: RetryPolicy = {
    maxAttempts: custom?.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts,
    initialDelayMs: custom?.initialDelayMs ?? DEFAULT_RETRY_POLICY.initialDelayMs,
    backoffMultiplier: custom?.backoffMultiplier ?? DEFAULT_RETRY_POLICY.backoffMultiplier,
    maxDelayMs: custom?.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs,
    jitter: custom?.jitter !== undefined ? custom.jitter : DEFAULT_RETRY_POLICY.jitter,
    ...(custom?.isRetryable !== undefined ? { isRetryable: custom.isRetryable } : {}),
  };
  return policy;
}

export function calculateBackoffDelay(
  attempt: number,
  policy: RetryPolicy,
  randomFn: () => number = Math.random
): number {
  if (attempt <= 1) return 0;

  // attempt 2 = 1st retry
  const exponent = attempt - 2;
  const rawDelay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, exponent);
  const boundedDelay = Math.min(rawDelay, policy.maxDelayMs);

  if (policy.jitter) {
    // Full jitter between 0 and boundedDelay
    return Math.floor(randomFn() * (boundedDelay + 1));
  }

  return Math.floor(boundedDelay);
}

export function isRetryableError(error: unknown, policy: RetryPolicy): boolean {
  if (error instanceof WorkflowCancelledError) {
    return false;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return false;
  }
  if (policy.isRetryable) {
    return policy.isRetryable(error);
  }
  return true;
}
