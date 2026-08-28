import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/db/client";

/** Tell the authenticated browser whether it still needs to finish an invitation. */
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ pending: false });

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "invited")
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Could not check invitation status" },
      { status: 500 }
    );
  }

  return NextResponse.json({ pending: Boolean(data) });
}
