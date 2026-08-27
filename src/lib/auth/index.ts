/**
 * Authentication helpers for Server Components and Server Actions.
 */

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/db/client";
import type { Membership, User } from "@/lib/db/types";
import type { AuthorizedContext } from "@/lib/permissions";

export interface SessionUser {
  id: string;
  email: string;
}

/** Current authenticated user from Supabase Auth, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
}

/** Redirect to sign-in when unauthenticated. */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/auth/sign-in");
  return user;
}

/**
 * Load the caller's app profile + memberships as an AuthorizedContext.
 * This is the single source of truth for tenant scoping in server code.
 */
export async function getAuthorizedContext(): Promise<
  (AuthorizedContext & { profile: User | null }) | null
> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const supabase = await createServerSupabase();

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("users").select("*").eq("id", sessionUser.id).single(),
    supabase
      .from("memberships")
      .select("*")
      .eq("user_id", sessionUser.id)
      .eq("status", "active"),
  ]);

  return {
    userId: sessionUser.id,
    memberships: (memberships ?? []) as Membership[],
    profile: (profile as User) ?? null,
  };
}

export async function requireAuthorizedContext() {
  const ctx = await getAuthorizedContext();
  if (!ctx) redirect("/auth/sign-in");
  return ctx;
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
}
