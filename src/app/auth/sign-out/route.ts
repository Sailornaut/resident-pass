import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/db/client";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/auth/sign-in", request.url), {
    status: 302,
  });
}
