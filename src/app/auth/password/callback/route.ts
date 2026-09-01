import { type NextRequest, NextResponse } from "next/server";
import { configuredAppUrl } from "@/lib/app-url";
import { createServerSupabase } from "@/lib/db/client";

function signInRedirect(request: NextRequest) {
  return NextResponse.redirect(
    `${configuredAppUrl(request.nextUrl.origin)}/auth/sign-in?auth_error=recovery`
  );
}

/** Exchange the recovery code for a session before showing password setup. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return signInRedirect(request);

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return signInRedirect(request);

  return NextResponse.redirect(
    `${configuredAppUrl(request.nextUrl.origin)}/auth/set-password`
  );
}
