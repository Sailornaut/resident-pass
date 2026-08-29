import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/db/client";
import { completeAppUserProfile } from "@/server/services/auth-service";

function appUrl(request: NextRequest): string {
  // Return to the host that initiated OAuth so the session cookies written by
  // this callback remain available after the redirect.
  return request.nextUrl.origin;
}

function authErrorRedirect(request: NextRequest, reason: string) {
  return NextResponse.redirect(
    `${appUrl(request)}/auth/sign-in?auth_error=${encodeURIComponent(reason)}`
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");

  if (!code) return authErrorRedirect(request, "oauth");

  const supabase = await createServerSupabase();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined
  );

  if (exchangeError) return authErrorRedirect(request, "oauth");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return authErrorRedirect(request, "oauth");

  const result = await completeAppUserProfile(user);
  if (!result.ok) return authErrorRedirect(request, "profile");

  return NextResponse.redirect(`${appUrl(request)}/`);
}
