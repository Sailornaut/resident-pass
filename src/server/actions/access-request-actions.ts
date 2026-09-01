"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedContext } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/db/client";
import { createAccessRequestSchema, flattenErrors } from "@/lib/validation";
import type { ActionState } from "@/server/actions/pass-actions";

export async function createAccessRequestAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Honeypot: return the normal non-enumerating response to simple form bots.
  if (formData.get("website")) {
    return { ok: true, message: "Your request was sent for administrator review." };
  }

  const ctx = await getAuthorizedContext();
  const parsed = createAccessRequestSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    requested_unit_label: formData.get("requested_unit_label"),
    community_id: formData.get("community_id"),
  });

  if (!parsed.success) {
    return { ok: false, errors: flattenErrors(parsed.error) };
  }

  if (ctx?.memberships.some((membership) => membership.role === "resident" && membership.unit_id)) {
    return { ok: false, message: "Your account is already linked to a residence." };
  }

  const admin = createAdminSupabase();
  const { data: community, error: communityError } = await admin
    .from("communities")
    .select("id, name")
    .eq("id", parsed.data.community_id)
    .eq("status", "active")
    .maybeSingle();

  if (communityError || !community) {
    return { ok: false, message: "Select a valid community." };
  }

  const email = parsed.data.email.toLowerCase();
  const { data: pendingRequest, error: pendingError } = await admin
    .from("user_access_requests")
    .select("id")
    .eq("community_id", community.id)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingError) {
    return { ok: false, message: "Could not check your existing requests." };
  }
  if (pendingRequest) {
    return { ok: true, message: "Your request was sent for administrator review." };
  }

  const { error: insertError } = await admin.from("user_access_requests").insert({
    community_id: community.id,
    requester_user_id: ctx?.userId ?? null,
    email,
    full_name: parsed.data.full_name,
    requested_unit_label: parsed.data.requested_unit_label,
    note: null,
  });

  if (insertError) {
    return {
      ok: false,
      message:
        insertError.code === "23505"
          ? "Your request was sent for administrator review."
          : "Could not submit your request. Please try again.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/user-requests");
  return {
    ok: true,
    message: `Your request was sent to the ${community.name} administrators.`,
  };
}
