/**
 * Centralized pass-issuance rules engine.
 *
 * All policy checks run here, in deterministic order, so different
 * communities can have different policies without branching UI code.
 * Every rejection returns a machine-readable code and a human-readable
 * reason suitable for direct display to the resident.
 */

import type { ParkingPass, ParkingRuleSet, Membership, Community } from "@/lib/db/types";

export type RuleCode =
  | "NO_ACTIVE_MEMBERSHIP"
  | "UNIT_NOT_AUTHORIZED"
  | "COMMUNITY_INACTIVE"
  | "PLATE_REQUIRED"
  | "INVALID_INTERVAL"
  | "DURATION_EXCEEDED"
  | "ADVANCE_WINDOW_EXCEEDED"
  | "ACTIVE_LIMIT_REACHED"
  | "MONTHLY_LIMIT_REACHED"
  | "DUPLICATE_OVERLAPPING_PASS";

export interface RuleViolation {
  code: RuleCode;
  message: string;
}

export interface RuleEvaluationResult {
  allowed: boolean;
  violations: RuleViolation[];
}

export interface RuleContext {
  /** The requester's active memberships. */
  memberships: Membership[];
  /** The community the pass is requested in. */
  community: Community;
  /** The community's configured rules. */
  rules: ParkingRuleSet;
  /** All non-cancelled/non-revoked passes for the target unit that are active or scheduled. */
  unitActivePasses: ParkingPass[];
  /** Count of all passes issued by this unit in the rolling 30-day window, including cancelled/revoked passes. */
  monthlyIssuedCount: number;
  /** Temporary resident-specific passes approved by a community administrator. */
  monthlyAllowanceBonus?: number;
  /** Existing passes for the same plate in this unit (any live status). */
  samePlatePasses: ParkingPass[];
}

export interface PassRequest {
  unit_id: string;
  plate: string;
  valid_from: Date;
  valid_until: Date;
  now?: Date;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Evaluate all issuance rules in deterministic order.
 * Collects every violation rather than stopping at the first,
 * so the UI can show the complete picture.
 */
export function evaluatePassRequest(
  request: PassRequest,
  ctx: RuleContext
): RuleEvaluationResult {
  const violations: RuleViolation[] = [];
  const now = request.now ?? new Date();

  // 1. Requester has an active membership
  const activeMemberships = ctx.memberships.filter((m) => m.status === "active");
  if (activeMemberships.length === 0) {
    violations.push({
      code: "NO_ACTIVE_MEMBERSHIP",
      message: "Your account is not associated with an active residence. Contact your community administrator.",
    });
  }

  // 2. Selected unit belongs to the requester
  const unitAuthorized = activeMemberships.some((m) => m.unit_id === request.unit_id);
  if (activeMemberships.length > 0 && !unitAuthorized) {
    violations.push({
      code: "UNIT_NOT_AUTHORIZED",
      message: "You are not authorized to request passes for this unit.",
    });
  }

  // 3. Community is active
  if (ctx.community.status !== "active") {
    violations.push({
      code: "COMMUNITY_INACTIVE",
      message: "This community is not currently accepting pass requests.",
    });
  }

  // 4. Plate present
  if (!request.plate || request.plate.trim().length < 2) {
    violations.push({
      code: "PLATE_REQUIRED",
      message: "A guest vehicle license plate is required.",
    });
  }

  // 5. Interval valid (end after start, not entirely in the past)
  if (request.valid_until <= request.valid_from) {
    violations.push({
      code: "INVALID_INTERVAL",
      message: "The pass end time must be after the start time.",
    });
  } else if (request.valid_until <= now) {
    violations.push({
      code: "INVALID_INTERVAL",
      message: "The requested pass would already be expired.",
    });
  }

  // 6. Duration within community maximum
  const durationHours =
    (request.valid_until.getTime() - request.valid_from.getTime()) / HOUR_MS;
  if (durationHours > ctx.rules.max_duration_hours) {
    violations.push({
      code: "DURATION_EXCEEDED",
      message: `Passes may not exceed ${formatHours(ctx.rules.max_duration_hours)}. Requested: ${formatHours(Math.ceil(durationHours))}.`,
    });
  }

  // 7. Start date within advance window
  const advanceMs = request.valid_from.getTime() - now.getTime();
  if (advanceMs > ctx.rules.advance_window_days * DAY_MS) {
    violations.push({
      code: "ADVANCE_WINDOW_EXCEEDED",
      message: `Passes may only be requested up to ${ctx.rules.advance_window_days} days in advance.`,
    });
  }

  // 8. Unit under simultaneous active/scheduled pass limit
  const liveCount = ctx.unitActivePasses.filter(
    (p) => p.status === "active" || p.status === "scheduled"
  ).length;
  if (liveCount >= ctx.rules.max_active_passes) {
    violations.push({
      code: "ACTIVE_LIMIT_REACHED",
      message: `This unit already has ${liveCount} of ${ctx.rules.max_active_passes} allowed active or scheduled passes.`,
    });
  }

  // 9. Rolling monthly issuance limit
  const effectiveMonthlyLimit =
    ctx.rules.monthly_limit + (ctx.monthlyAllowanceBonus ?? 0);
  if (ctx.monthlyIssuedCount >= effectiveMonthlyLimit) {
    violations.push({
      code: "MONTHLY_LIMIT_REACHED",
      message: `This unit has reached its limit of ${effectiveMonthlyLimit} passes in the past 30 days.`,
    });
  }

  // 10. No identical overlapping pass for the same plate/unit
  const overlapping = ctx.samePlatePasses.some((p) => {
    if (p.status === "cancelled" || p.status === "revoked" || p.status === "expired") {
      return false;
    }
    const existingFrom = new Date(p.valid_from).getTime();
    const existingUntil = new Date(p.valid_until).getTime();
    return (
      request.valid_from.getTime() < existingUntil &&
      request.valid_until.getTime() > existingFrom
    );
  });
  if (overlapping) {
    violations.push({
      code: "DUPLICATE_OVERLAPPING_PASS",
      message: "An active pass already exists for this plate during the requested time window.",
    });
  }

  return { allowed: violations.length === 0, violations };
}

function formatHours(hours: number): string {
  if (hours % 24 === 0 && hours >= 24) {
    const days = hours / 24;
    return days === 1 ? "1 day" : `${days} days`;
  }
  return hours === 1 ? "1 hour" : `${hours} hours`;
}
