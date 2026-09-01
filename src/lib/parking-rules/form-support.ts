import type { RuleViolation } from "@/lib/parking-rules";

const HALF_HOUR_MS = 30 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDateTimeLocal(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface PassDateConstraints {
  startMax: string;
  endMin?: string;
  endMax?: string;
}

/**
 * Build browser constraints from the same community-configurable values used
 * by the authoritative server rule engine.
 */
export function getPassDateConstraints(
  validFrom: string,
  maxDurationHours: number,
  advanceWindowDays: number,
  now = new Date()
): PassDateConstraints {
  const start = parseDateTimeLocal(validFrom);

  return {
    startMax: toDateTimeLocalValue(
      new Date(now.getTime() + advanceWindowDays * DAY_MS)
    ),
    endMin: start
      ? toDateTimeLocalValue(new Date(start.getTime() + HALF_HOUR_MS))
      : undefined,
    endMax: start
      ? toDateTimeLocalValue(new Date(start.getTime() + maxDurationHours * HOUR_MS))
      : undefined,
  };
}

/** Map deterministic rule failures to the field the resident can correct. */
export function ruleViolationsToFormErrors(
  violations: RuleViolation[]
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const violation of violations) {
    const field = (() => {
      switch (violation.code) {
        case "INVALID_INTERVAL":
        case "DURATION_EXCEEDED":
          return "valid_until";
        case "ADVANCE_WINDOW_EXCEEDED":
          return "valid_from";
        case "PLATE_REQUIRED":
        case "DUPLICATE_OVERLAPPING_PASS":
          return "plate";
        case "UNIT_NOT_AUTHORIZED":
          return "unit_id";
        default:
          return "_form";
      }
    })();

    errors[field] = errors[field]
      ? `${errors[field]} ${violation.message}`
      : violation.message;
  }

  return errors;
}
