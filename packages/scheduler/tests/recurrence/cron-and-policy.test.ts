import { describe, test, expect } from "bun:test";
import {
  validateCronExpression,
  getNextCronOccurrence,
} from "../../src/recurrence/cron";
import { resolveMissedOccurrences } from "../../src/recurrence/missed-policy";
import { InvalidCronError } from "../../src/errors/scheduler-errors";

describe("Recurrence & Cron Calculation", () => {
  test("calculates next occurrence for valid cron", () => {
    const base = new Date("2026-01-01T10:00:00Z");
    const next = getNextCronOccurrence("*/15 * * * *", base, "UTC");

    expect(next.toISOString()).toBe("2026-01-01T10:15:00.000Z");
  });

  test("rejects invalid cron expressions", () => {
    expect(() => validateCronExpression("invalid-cron")).toThrow(InvalidCronError);
    expect(() => validateCronExpression("99 * * * *")).toThrow(InvalidCronError);
  });

  test("handles timezones explicitly", () => {
    // 9 AM in New York is 14:00 UTC (standard time) or 13:00 UTC (EDT)
    const base = new Date("2026-01-01T00:00:00Z");
    const nextNy = getNextCronOccurrence("0 9 * * *", base, "America/New_York");
    const nextTokyo = getNextCronOccurrence("0 9 * * *", base, "Asia/Tokyo");

    // They must yield different UTC timestamps for 9 AM local time
    expect(nextNy.toISOString()).not.toBe(nextTokyo.toISOString());
    expect(nextTokyo.toISOString()).toBe("2026-01-02T00:00:00.000Z"); // Next 9 AM JST after 09:00 is next day
    expect(nextNy.toISOString()).toBe("2026-01-01T14:00:00.000Z"); // 9 AM EST is 14:00 UTC
  });
});

describe("Missed Execution Policies", () => {
  const cron = "0 * * * *"; // Hourly

  test("SKIP policy ignores missed occurrences and schedules future run", () => {
    const scheduled = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T14:30:00Z"); // 4 hours later

    const result = resolveMissedOccurrences({
      cronExpression: cron,
      policy: "SKIP",
      scheduledNextRunAt: scheduled,
      now,
    });

    expect(result.dispatchTimes.length).toBe(1);
    expect(result.dispatchTimes[0]!.toISOString()).toBe("2026-01-01T10:00:00.000Z");
    expect(result.nextRunAt.toISOString()).toBe("2026-01-01T15:00:00.000Z");
    expect(result.skippedCount).toBe(4); // 11:00, 12:00, 13:00, 14:00 skipped
  });

  test("LATEST policy returns only the most recent missed occurrence", () => {
    const scheduled = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T14:30:00Z"); // 10, 11, 12, 13, 14 passed

    const result = resolveMissedOccurrences({
      cronExpression: cron,
      policy: "LATEST",
      scheduledNextRunAt: scheduled,
      now,
    });

    expect(result.dispatchTimes.length).toBe(1);
    expect(result.dispatchTimes[0]!.toISOString()).toBe("2026-01-01T14:00:00.000Z");
    expect(result.nextRunAt.toISOString()).toBe("2026-01-01T15:00:00.000Z");
    expect(result.skippedCount).toBe(4);
  });

  test("CATCH_UP policy returns all missed occurrences within limit", () => {
    const scheduled = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T13:30:00Z"); // 10, 11, 12, 13 passed

    const result = resolveMissedOccurrences({
      cronExpression: cron,
      policy: "CATCH_UP",
      scheduledNextRunAt: scheduled,
      now,
      maxCatchUp: 10,
    });

    expect(result.dispatchTimes.length).toBe(4);
    expect(result.dispatchTimes.map((d) => d.toISOString())).toEqual([
      "2026-01-01T10:00:00.000Z",
      "2026-01-01T11:00:00.000Z",
      "2026-01-01T12:00:00.000Z",
      "2026-01-01T13:00:00.000Z",
    ]);
    expect(result.nextRunAt.toISOString()).toBe("2026-01-01T14:00:00.000Z");
    expect(result.skippedCount).toBe(0);
  });

  test("CATCH_UP caps large downtime to avoid unbounded backlog", () => {
    const scheduled = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-02T00:00:00Z"); // 25 hourly occurrences passed

    const result = resolveMissedOccurrences({
      cronExpression: cron,
      policy: "CATCH_UP",
      scheduledNextRunAt: scheduled,
      now,
      maxCatchUp: 5,
    });

    expect(result.dispatchTimes.length).toBe(5);
    expect(result.skippedCount).toBe(20);
    expect(result.nextRunAt.toISOString()).toBe("2026-01-02T01:00:00.000Z");
  });
});
