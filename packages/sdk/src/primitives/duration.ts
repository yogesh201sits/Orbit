import type { Duration } from "../workflow/types";
import { ValidationError } from "../errors/sdk-errors";

/**
 * Parses a duration number (ms) or string (e.g. "500ms", "10s", "5m", "2h", "1d") into milliseconds.
 */
export function parseDuration(duration: Duration): number {
  if (typeof duration === "number") {
    if (duration < 0 || isNaN(duration)) {
      throw new ValidationError(`Duration cannot be negative or NaN, got ${duration}`);
    }
    return Math.round(duration);
  }

  if (typeof duration === "string") {
    const trimmed = duration.trim();
    const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i.exec(trimmed);
    if (!match) {
      throw new ValidationError(
        `Invalid duration format "${duration}". Expected format like "500ms", "10s", "5m", "2h", "1d".`
      );
    }

    const value = parseFloat(match[1]!);
    const unit = (match[2] ?? "ms").toLowerCase();

    switch (unit) {
      case "d":
        return Math.round(value * 86_400_000);
      case "h":
        return Math.round(value * 3_600_000);
      case "m":
        return Math.round(value * 60_000);
      case "s":
        return Math.round(value * 1_000);
      case "ms":
      default:
        return Math.round(value);
    }
  }

  throw new ValidationError(`Invalid duration type: expected number or string, got ${typeof duration}`);
}
