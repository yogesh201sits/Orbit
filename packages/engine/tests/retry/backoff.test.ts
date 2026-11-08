import { describe, test, expect } from "bun:test";
import {
  calculateBackoffDelay,
  resolveRetryPolicy,
  isRetryableError,
} from "../../src/retry/backoff";
import { WorkflowCancelledError } from "../../src/errors/engine-errors";

describe("Retry & Backoff", () => {
  test("calculates deterministic exponential backoff without jitter", () => {
    const policy = resolveRetryPolicy({
      maxAttempts: 5,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 5000,
      jitter: false,
    });

    expect(calculateBackoffDelay(1, policy)).toBe(0);
    expect(calculateBackoffDelay(2, policy)).toBe(1000); // 1000 * 2^0
    expect(calculateBackoffDelay(3, policy)).toBe(2000); // 1000 * 2^1
    expect(calculateBackoffDelay(4, policy)).toBe(4000); // 1000 * 2^2
    expect(calculateBackoffDelay(5, policy)).toBe(5000); // capped at maxDelayMs 5000
  });

  test("applies jitter bounded by delay", () => {
    const policy = resolveRetryPolicy({
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 10000,
      jitter: true,
    });

    // Mock random returning 0.5
    const delay = calculateBackoffDelay(2, policy, () => 0.5);
    expect(delay).toBe(500);
  });

  test("classifies retryable errors", () => {
    const policy = resolveRetryPolicy({
      isRetryable: (err) => !(err instanceof TypeError),
    });

    expect(isRetryableError(new Error("network error"), policy)).toBe(true);
    expect(isRetryableError(new TypeError("invalid type"), policy)).toBe(false);
    expect(isRetryableError(new WorkflowCancelledError("r1"), policy)).toBe(false);
  });
});
