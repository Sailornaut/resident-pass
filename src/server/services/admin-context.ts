/**
 * Resolve which community an admin is operating on.
 *
 * MVP: admins typically manage one community, so we use the first
 * active admin membership. Post-MVP the portfolio view lets a
 * management-company admin switch communities explicitly.
 */

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/db/client";
import type { AuthorizedContext } from "@/lib/permissions";
import type { Community } from "@/lib/db/types";

export async function resolveAdminCommunity(
  ctx: AuthorizedContext
): Promise<Community> {
  const adminMembership = ctx.memberships.find(
    (m) =>
      (m.role === "admin" || m.role === "platform_admin") && m.status === "active"
  );
  if (!adminMembership) redirect("/dashboard");

  const supabase = await createServerSupabase();
  const { data: community } = await supabase
    .from("communities")
    .select("*")
    .eq("id", adminMembership.community_id)
    .single();

  if (!community) redirect("/dashboard");
  return community as Community;
}
