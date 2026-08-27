import { redirect } from "next/navigation";
import { getAuthorizedContext } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/permissions";

/**
 * Root route: send each signed-in user to the right home
 * based on their memberships. Unauthenticated → sign-in.
 */
export default async function Home() {
  const ctx = await getAuthorizedContext();
  if (!ctx) redirect("/auth/sign-in");

  if (isPlatformAdmin(ctx)) redirect("/platform/communities");

  const isAdmin = ctx.memberships.some((m) => m.role === "admin");
  if (isAdmin) redirect("/admin/dashboard");

  redirect("/dashboard");
}
