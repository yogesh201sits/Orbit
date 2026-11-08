import { Cron } from "croner";
import type { MissedExecutionPolicy } from "@durable/storage";
import { getNextCronOccurrence, validateCronExpression } from "./cron";

export interface ResolvedMissedOccurrences {
  /** The execution timestamps that should be dispatched right now */
  readonly dispatchTimes: readonly Date[];
  /** The next scheduled occurrence strictly after `now` */
  readonly nextRunAt: Date;
  /** Number of occurrences that were skipped due to policy or maxCatchUp */
  readonly skippedCount: number;
}

export interface ResolveMissedPolicyOptions {
  readonly cronExpression: string;
  readonly timezone?: string | undefined;
  readonly policy: MissedExecutionPolicy;
  readonly scheduledNextRunAt: Date;
  readonly now?: Date | undefined;
  /** Maximum number of catch-up executions allowed (default: 10) */
  readonly maxCatchUp?: number | undefined;
}

export const DEFAULT_MAX_CATCH_UP = 10;

export function resolveMissedOccurrences(
  options: ResolveMissedPolicyOptions
): ResolvedMissedOccurrences {
  const {
    cronExpression,
    timezone = "UTC",
    policy,
    scheduledNextRunAt,
    now = new Date(),
    maxCatchUp = DEFAULT_MAX_CATCH_UP,
  } = options;

  validateCronExpression(cronExpression, timezone);
  const cron = new Cron(cronExpression, { timezone });

  // If the scheduled time is in the future, nothing is missed yet
  if (scheduledNextRunAt.getTime() > now.getTime()) {
    return {
      dispatchTimes: [],
      nextRunAt: scheduledNextRunAt,
      skippedCount: 0,
    };
  }

  // Find occurrences that fell between scheduledNextRunAt and now
  const missed: Date[] = [scheduledNextRunAt];
  let cursor: Date | null = scheduledNextRunAt;

  while (true) {
    cursor = cron.nextRun(cursor);
    if (!cursor || cursor.getTime() > now.getTime()) {
      break;
    }
    missed.push(cursor);
    // Hard limit on lookahead loop during downtime calculation
    if (missed.length > 500) {
      break;
    }
  }

  // The next future occurrence after now
  const nextFutureRun = getNextCronOccurrence(cronExpression, now, timezone);

  const normalizedPolicy = String(policy || "SKIP").toUpperCase();

  switch (normalizedPolicy) {
    case "SKIP": {
      // Execute only the current execution, skip all intermediate missed occurrences
      const skippedCount = Math.max(0, missed.length - 1);
      return {
        dispatchTimes: [scheduledNextRunAt],
        nextRunAt: nextFutureRun,
        skippedCount,
      };
    }

    case "LATEST": {
      // Execute only the single most recent missed occurrence
      const latest = missed[missed.length - 1]!;
      const skippedCount = Math.max(0, missed.length - 1);
      return {
        dispatchTimes: [latest],
        nextRunAt: nextFutureRun,
        skippedCount,
      };
    }

    case "CATCH_UP": {
      // Execute all missed occurrences up to maxCatchUp
      if (missed.length <= maxCatchUp) {
        return {
          dispatchTimes: missed,
          nextRunAt: nextFutureRun,
          skippedCount: 0,
        };
      }

      // If backlog exceeds maxCatchUp, keep the latest maxCatchUp occurrences to avoid unbounded flood
      const kept = missed.slice(missed.length - maxCatchUp);
      const skippedCount = missed.length - kept.length;
      return {
        dispatchTimes: kept,
        nextRunAt: nextFutureRun,
        skippedCount,
      };
    }

    default: {
      return {
        dispatchTimes: [scheduledNextRunAt],
        nextRunAt: nextFutureRun,
        skippedCount: 0,
      };
    }
  }
}
