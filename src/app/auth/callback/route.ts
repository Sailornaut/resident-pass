/**
 * Magic-link callback: exchanges the auth code for a session,
 * ensures an app-level user row exists, then sends the user home.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Ensure the app users row mirrors the auth user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const admin = createAdminSupabase();
        await admin.from("users").upsert(
          {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name ?? null,
          },
          { onConflict: "id", ignoreDuplicates: false }
        );
      }

      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/sign-in?error=auth`);
}
