import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/db/client";

/** Ensure an authenticated Supabase user has the app-level profile row it needs. */
export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  if (error) {
    return NextResponse.json(
      { error: "Could not complete account setup" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
