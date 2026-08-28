import type { User } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/db/client";

type CompleteProfileResult =
  | { ok: true }
  | { ok: false; error: "profile" | "memberships" };

/** Create the app profile for a Supabase user and activate any pending invitations. */
export async function completeAppUserProfile(
  user: User
): Promise<CompleteProfileResult> {
  if (!user.email) return { ok: false, error: "profile" };

  const admin = createAdminSupabase();
  const { error } = await admin.from("users").upsert(
    {
      id: user.id,
      email: user.email.toLowerCase(),
      full_name: user.user_metadata?.full_name ?? null,
      status: "active",
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  if (error) return { ok: false, error: "profile" };

  const { error: membershipError } = await admin
    .from("memberships")
    .update({ status: "active" })
    .eq("user_id", user.id)
    .eq("status", "invited");

  if (membershipError) return { ok: false, error: "memberships" };

  return { ok: true };
}
