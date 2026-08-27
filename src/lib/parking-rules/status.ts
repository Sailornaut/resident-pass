import type { ParkingPass, EffectivePassStatus } from "@/lib/db/types";

/**
 * Compute the effective status of a pass at a given moment.
 *
 * Stored status records explicit lifecycle events (revoked, cancelled);
 * time-based states (not yet valid, active, expired) are derived from
 * the validity window so the database never lags behind the clock.
 */
export function effectiveStatus(
  pass: Pick<ParkingPass, "status" | "valid_from" | "valid_until">,
  now: Date = new Date()
): EffectivePassStatus {
  // Explicit terminal states always win
  if (pass.status === "revoked") return "revoked";
  if (pass.status === "cancelled") return "cancelled";

  const from = new Date(pass.valid_from);
  const until = new Date(pass.valid_until);

  if (now < from) return "not_yet_valid";
  if (now >= until) return "expired";
  return "active";
}

/** Human-friendly labels for every effective status. */
export const STATUS_LABELS: Record<EffectivePassStatus | "not_found", string> = {
  active: "VALID",
  not_yet_valid: "NOT YET VALID",
  expired: "EXPIRED",
  revoked: "REVOKED",
  cancelled: "CANCELLED",
  not_found: "NOT FOUND",
};

/** Whether a resident may still cancel this pass. */
export function isCancellable(
  pass: Pick<ParkingPass, "status" | "valid_from" | "valid_until">,
  allowResidentCancel: boolean,
  now: Date = new Date()
): boolean {
  if (!allowResidentCancel) return false;
  const status = effectiveStatus(pass, now);
  return status === "active" || status === "not_yet_valid";
}
