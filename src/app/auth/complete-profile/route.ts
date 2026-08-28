import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/db/client";
import { completeAppUserProfile } from "@/server/services/auth-service";

/** Ensure an authenticated Supabase user has the app-level profile row it needs. */
export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await completeAppUserProfile(user);
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.error === "memberships"
            ? "Could not activate account memberships"
            : "Could not complete account setup",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
