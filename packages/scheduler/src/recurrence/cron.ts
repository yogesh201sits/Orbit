import { Cron } from "croner";
import { InvalidCronError } from "../errors/scheduler-errors";

export interface CronScheduleOptions {
  readonly timezone?: string | undefined;
}

export function validateCronExpression(expression: string, timezone = "UTC"): void {
  try {
    // Attempt instantiation with timezone validation
    new Cron(expression, { timezone });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new InvalidCronError(expression, msg);
  }
}

export function isValidCronExpression(expression: string, timezone = "UTC"): boolean {
  try {
    validateCronExpression(expression, timezone);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculates the next occurrence after `afterDate`.
 */
export function getNextCronOccurrence(
  expression: string,
  afterDate: Date,
  timezone = "UTC"
): Date {
  validateCronExpression(expression, timezone);
  const cron = new Cron(expression, { timezone });
  const next = cron.nextRun(afterDate);

  if (!next) {
    throw new InvalidCronError(
      expression,
      "Cron expression does not yield any future occurrence"
    );
  }

  return next;
}
