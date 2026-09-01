/**
 * Pass service — core business logic for issuing, cancelling,
 * revoking, and verifying passes. Called by server actions and
 * API route handlers; never from the client directly.
 */

import { createServerSupabase, createAdminSupabase } from "@/lib/db/client";
import { evaluatePassRequest, type RuleEvaluationResult } from "@/lib/parking-rules";
import { effectiveStatus } from "@/lib/parking-rules/status";
import { generatePassCode, normalizePassCode, isValidPassCodeFormat } from "@/lib/qr/pass-code";
import { authorizedUnitIds, isAdminOf, type AuthorizedContext } from "@/lib/permissions";
import type {
  Community,
  CreatePassInput,
  Membership,
  ParkingPass,
  ParkingRuleSet,
  VerificationResult,
} from "@/lib/db/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_VERIFICATION_WINDOW_MS = 5 * 60 * 1000;

export interface IssueResult {
  ok: boolean;
  pass?: ParkingPass;
  evaluation?: RuleEvaluationResult;
  error?: string;
}

/**
 * Issue a new temporary pass for a resident, enforcing all community rules.
 */
export async function issuePass(
  ctx: AuthorizedContext,
  input: CreatePassInput
): Promise<IssueResult> {
  const supabase = await createServerSupabase();

  // Resolve the unit's community server-side — never trust client community IDs.
  const { data: unit } = await supabase
    .from("units")
    .select("*, communities(*)")
    .eq("id", input.unit_id)
    .single();

  if (!unit) return { ok: false, error: "Unit not found." };

  const community = (unit as { communities: Community }).communities;
  const communityId = community.id;

  // Load rules + current pass state for evaluation
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const [
    { data: rules },
    { data: unitPasses },
    { data: monthlyPasses },
    { data: allowanceGrants },
  ] =
    await Promise.all([
      supabase
        .from("parking_rule_sets")
        .select("*")
        .eq("community_id", communityId)
        .single(),
      supabase
        .from("parking_passes")
        .select("*")
        .eq("unit_id", input.unit_id)
        .in("status", ["active", "scheduled"]),
      supabase
        .from("parking_passes")
        .select("id")
        .eq("unit_id", input.unit_id)
        .gte("created_at", thirtyDaysAgo),
      supabase
        .from("pass_allowance_grants")
        .select("additional_passes")
        .eq("community_id", communityId)
        .eq("user_id", ctx.userId)
        .gt("expires_at", now.toISOString()),
    ]);

  if (!rules) return { ok: false, error: "Community parking rules are not configured." };

  const samePlatePasses = ((unitPasses ?? []) as ParkingPass[]).filter(
    (p) => p.plate === input.plate.toUpperCase().replace(/\s+/g, "")
  );
  const monthlyAllowanceBonus = (allowanceGrants ?? []).reduce(
    (total, grant) => total + grant.additional_passes,
    0
  );

  const evaluation = evaluatePassRequest(
    {
      unit_id: input.unit_id,
      plate: input.plate,
      valid_from: new Date(input.valid_from),
      valid_until: new Date(input.valid_until),
    },
    {
      memberships: ctx.memberships as Membership[],
      community,
      rules: rules as ParkingRuleSet,
      unitActivePasses: (unitPasses ?? []) as ParkingPass[],
      monthlyIssuedCount: (monthlyPasses ?? []).length,
      monthlyAllowanceBonus,
      samePlatePasses,
    }
  );

  if (!evaluation.allowed) {
    return { ok: false, evaluation };
  }

  // Generate a unique public code (retry on the rare collision)
  const admin = createAdminSupabase();
  let publicCode = generatePassCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await admin
      .from("parking_passes")
      .select("id")
      .eq("public_code", publicCode)
      .maybeSingle();
    if (!existing) break;
    publicCode = generatePassCode();
  }

  const startsNow = new Date(input.valid_from) <= now;

  const { data: pass, error } = await supabase
    .from("parking_passes")
    .insert({
      public_code: publicCode,
      community_id: communityId,
      unit_id: input.unit_id,
      requester_user_id: ctx.userId,
      plate: input.plate.toUpperCase().replace(/\s+/g, ""),
      plate_state: input.plate_state,
      vehicle_make: input.vehicle_make || null,
      vehicle_color: input.vehicle_color || null,
      guest_name: input.guest_name || null,
      note: input.note || null,
      valid_from: input.valid_from,
      valid_until: input.valid_until,
      status: startsNow ? "active" : "scheduled",
    })
    .select()
    .single();

  if (error || !pass) {
    return { ok: false, error: "Could not create the pass. Please try again." };
  }

  await recordEvent(pass.id, ctx.userId, "created", {
    public_code: publicCode,
    plate: pass.plate,
  });

  return { ok: true, pass: pass as ParkingPass };
}

/** Resident cancels their own pass (policy permitting). */
export async function cancelPass(
  ctx: AuthorizedContext,
  passId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabase();

  const { data: pass } = await supabase
    .from("parking_passes")
    .select("*")
    .eq("id", passId)
    .single();

  if (!pass) return { ok: false, error: "Pass not found." };

  const p = pass as ParkingPass;
  const ownsPass = p.requester_user_id === ctx.userId;
  const ownsUnit = authorizedUnitIds(ctx).includes(p.unit_id);
  if (!ownsPass && !ownsUnit) {
    return { ok: false, error: "You may only cancel your own passes." };
  }

  const { data: rules } = await supabase
    .from("parking_rule_sets")
    .select("allow_resident_cancel")
    .eq("community_id", p.community_id)
    .single();

  if (rules && !rules.allow_resident_cancel) {
    return { ok: false, error: "Your community does not allow residents to cancel passes. Contact your administrator." };
  }

  const status = effectiveStatus(p);
  if (status === "expired" || status === "revoked" || status === "cancelled") {
    return { ok: false, error: `This pass is already ${status} and cannot be cancelled.` };
  }

  // The authorization decision is complete above. Perform the mutation with
  // the trusted server client because direct authenticated updates are not
  // granted by RLS.
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("parking_passes")
    .update({ status: "cancelled" })
    .eq("id", passId)
    .eq("community_id", p.community_id);

  if (error) return { ok: false, error: "Could not cancel the pass." };

  await recordEvent(passId, ctx.userId, "cancelled", {});
  return { ok: true };
}

/** Admin revokes a pass in their community. */
export async function revokePass(
  ctx: AuthorizedContext,
  passId: string,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabase();

  const { data: pass } = await supabase
    .from("parking_passes")
    .select("*")
    .eq("id", passId)
    .single();

  if (!pass) return { ok: false, error: "Pass not found." };
  const p = pass as ParkingPass;

  if (!isAdminOf(ctx, p.community_id)) {
    return { ok: false, error: "You are not an administrator of this community." };
  }

  if (p.status === "revoked") {
    return { ok: false, error: "This pass is already revoked." };
  }

  // The authorization decision is complete above. Perform the mutation with
  // the trusted server client because direct authenticated updates are not
  // granted by RLS.
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("parking_passes")
    .update({ status: "revoked" })
    .eq("id", passId)
    .eq("community_id", p.community_id);

  if (error) return { ok: false, error: "Could not revoke the pass." };

  await recordEvent(passId, ctx.userId, "revoked", { reason: reason ?? null });
  return { ok: true };
}

/**
 * Public verification by pass code. Unauthenticated; returns only
 * enforcement-relevant data and never resident identity.
 */
export async function verifyByPublicCode(rawCode: string): Promise<VerificationResult> {
  const code = normalizePassCode(rawCode);
  if (!isValidPassCodeFormat(code)) {
    return { status: "not_found" };
  }

  // Use the admin client: the public page has no session, but we control
  // exactly which fields are exposed below.
  const admin = createAdminSupabase();
  const { data: pass } = await admin
    .from("parking_passes")
    .select("id, public_code, plate, plate_state, valid_from, valid_until, status, communities(name, timezone)")
    .eq("public_code", code)
    .maybeSingle();

  if (!pass) {
    return { status: "not_found" };
  }

  const p = pass as unknown as ParkingPass & {
    communities: { name: string; timezone: string };
  };
  const status = effectiveStatus(p);
  const scanContext = await recordVerificationScan(p.id, status);

  return {
    status,
    community_name: p.communities?.name,
    community_timezone: p.communities?.timezone,
    plate: p.plate,
    plate_state: p.plate_state,
    valid_from: p.valid_from,
    valid_until: p.valid_until,
    public_code: p.public_code,
    ...scanContext,
  };
}

async function recordVerificationScan(
  passId: string,
  result: VerificationResult["status"]
): Promise<Pick<VerificationResult, "scan_count" | "previous_scan_at" | "recently_verified">> {
  const admin = createAdminSupabase();
  const { data: event, error } = await admin
    .from("pass_events")
    .insert({
      pass_id: passId,
      actor_user_id: null,
      event_type: "verified",
      metadata: { result },
    })
    .select("id, created_at")
    .single();

  if (error || !event) {
    console.error("Could not record pass verification event", error);
    return {};
  }

  const [{ count }, { data: previousScan }] = await Promise.all([
    admin
      .from("pass_events")
      .select("id", { count: "exact", head: true })
      .eq("pass_id", passId)
      .eq("event_type", "verified"),
    admin
      .from("pass_events")
      .select("created_at")
      .eq("pass_id", passId)
      .eq("event_type", "verified")
      .neq("id", event.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const previousScanAt = previousScan?.created_at;
  const recentlyVerified = previousScanAt
    ? new Date(event.created_at).getTime() - new Date(previousScanAt).getTime() <=
      RECENT_VERIFICATION_WINDOW_MS
    : false;

  return {
    scan_count: count ?? 1,
    previous_scan_at: previousScanAt,
    recently_verified: recentlyVerified,
  };
}

/** Append an immutable audit event. */
export async function recordEvent(
  passId: string,
  actorUserId: string | null,
  eventType: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const admin = createAdminSupabase();
  await admin.from("pass_events").insert({
    pass_id: passId,
    actor_user_id: actorUserId,
    event_type: eventType,
    metadata,
  });
}
