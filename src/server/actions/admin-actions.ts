"use server";

/**
 * Server actions for community administrator workflows.
 */

import { revalidatePath } from "next/cache";
import { requireAuthorizedContext } from "@/lib/auth";
import { requireAdminOf } from "@/lib/permissions";
import { createAdminSupabase, createServerSupabase } from "@/lib/db/client";
import {
  updateRulesSchema,
  createUnitSchema,
  addResidentSchema,
  grantPassAllowanceSchema,
  revokePassSchema,
  flattenErrors,
} from "@/lib/validation";
import { revokePass } from "@/server/services/pass-service";
import type { ActionState } from "./pass-actions";

export async function revokePassAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuthorizedContext();

  const parsed = revokePassSchema.safeParse({
    pass_id: formData.get("pass_id"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, errors: flattenErrors(parsed.error) };
  }

  const result = await revokePass(ctx, parsed.data.pass_id, parsed.data.reason || undefined);
  if (!result.ok) {
    return { ok: false, message: result.error };
  }

  revalidatePath("/admin/passes");
  revalidatePath(`/admin/passes/${parsed.data.pass_id}`);
  return { ok: true, message: "Pass revoked. Verification now shows REVOKED." };
}

export async function updateRulesAction(
  communityId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuthorizedContext();
  requireAdminOf(ctx, communityId);

  const parsed = updateRulesSchema.safeParse({
    max_active_passes: formData.get("max_active_passes"),
    max_duration_hours: formData.get("max_duration_hours"),
    monthly_limit: formData.get("monthly_limit"),
    advance_window_days: formData.get("advance_window_days"),
    allow_resident_cancel: formData.get("allow_resident_cancel") === "on",
  });
  if (!parsed.success) {
    return { ok: false, errors: flattenErrors(parsed.error) };
  }

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("parking_rule_sets")
    .update(parsed.data)
    .eq("community_id", communityId);

  if (error) {
    return { ok: false, message: "Could not save rules. Please try again." };
  }

  revalidatePath("/admin/rules");
  return { ok: true, message: "Parking rules updated. New requests will use these limits." };
}

export async function createUnitAction(
  communityId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuthorizedContext();
  requireAdminOf(ctx, communityId);

  const parsed = createUnitSchema.safeParse({
    unit_label: formData.get("unit_label"),
    address_label: formData.get("address_label") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, errors: flattenErrors(parsed.error) };
  }

  const admin = createAdminSupabase();
  const { error } = await admin.from("units").insert({
    community_id: communityId,
    unit_label: parsed.data.unit_label,
    address_label: parsed.data.address_label || null,
  });

  if (error) {
    const message = error.code === "23505"
      ? "A unit with that label already exists."
      : "Could not create the unit.";
    return { ok: false, message };
  }

  revalidatePath("/admin/units");
  return { ok: true, message: `Unit ${parsed.data.unit_label} created.` };
}

export async function grantPassAllowanceAction(
  communityId: string,
  userId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuthorizedContext();
  requireAdminOf(ctx, communityId);

  const parsed = grantPassAllowanceSchema.safeParse({
    additional_passes: formData.get("additional_passes"),
    valid_days: formData.get("valid_days"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, errors: flattenErrors(parsed.error) };
  }

  const admin = createAdminSupabase();
  const { data: membership } = await admin
    .from("memberships")
    .select("id")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .eq("role", "resident")
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    return { ok: false, message: "That user is not an active resident of this community." };
  }

  const expiresAt = new Date(
    Date.now() + parsed.data.valid_days * 24 * 60 * 60 * 1000
  ).toISOString();
  const { error } = await admin.from("pass_allowance_grants").insert({
    community_id: communityId,
    user_id: userId,
    granted_by_user_id: ctx.userId,
    additional_passes: parsed.data.additional_passes,
    reason: parsed.data.reason,
    expires_at: expiresAt,
  });

  if (error) {
    return { ok: false, message: "Could not grant the additional allowance." };
  }

  revalidatePath("/admin/units");
  revalidatePath("/dashboard");
  revalidatePath("/passes/new");
  return {
    ok: true,
    message: `${parsed.data.additional_passes} additional pass${parsed.data.additional_passes === 1 ? "" : "es"} approved for ${parsed.data.valid_days} days.`,
  };
}

export async function addResidentAction(
  communityId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuthorizedContext();
  requireAdminOf(ctx, communityId);

  const parsed = addResidentSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name") ?? "",
    unit_id: formData.get("unit_id"),
  });
  if (!parsed.success) {
    return { ok: false, errors: flattenErrors(parsed.error) };
  }

  const supabase = await createServerSupabase();

  // Verify the target unit actually belongs to this community (tenant isolation).
  const { data: unit } = await supabase
    .from("units")
    .select("id")
    .eq("id", parsed.data.unit_id)
    .eq("community_id", communityId)
    .single();

  if (!unit) {
    return { ok: false, message: "That unit does not belong to this community." };
  }

  const admin = createAdminSupabase();
  const email = parsed.data.email.toLowerCase();
  const { data: existingUsers, error: listError } =
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    return { ok: false, message: "Could not look up the resident account." };
  }
  const authUser = existingUsers.users.find(
    (candidate) => candidate.email?.toLowerCase() === email
  );

  if (!authUser) {
    return {
      ok: false,
      message: "No account was found for that email. Ask the resident to create an account first.",
    };
  }

  const { error: userError } = await admin.from("users").upsert(
    {
      id: authUser.id,
      email,
      full_name: parsed.data.full_name || null,
      status: "active",
    },
    { onConflict: "id" }
  );

  if (userError) {
    return { ok: false, message: "The resident profile could not be saved." };
  }

  const { error: membershipError } = await admin.from("memberships").upsert(
    {
      user_id: authUser.id,
      community_id: communityId,
      unit_id: parsed.data.unit_id,
      role: "resident",
      status: "active",
    },
    { onConflict: "user_id,community_id,role" }
  );

  if (membershipError) {
    return { ok: false, message: "The unit assignment could not be saved." };
  }

  revalidatePath("/admin/units");
  return {
    ok: true,
    message: `${email} is now assigned to the selected unit.`,
  };
}
