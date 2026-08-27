/**
 * Platform administration — internal-only, visually minimal by design.
 * Lists all communities; creation is handled via the seed script or
 * direct DB access for MVP, with a form arriving in pilot hardening.
 */

import { redirect } from "next/navigation";
import { requireAuthorizedContext } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/permissions";
import { createAdminSupabase } from "@/lib/db/client";
import type { Community } from "@/lib/db/types";

export const metadata = { title: "Communities · Platform" };

export default async function PlatformCommunitiesPage() {
  const ctx = await requireAuthorizedContext();
  if (!isPlatformAdmin(ctx)) redirect("/dashboard");

  const admin = createAdminSupabase();
  const { data: communities } = await admin
    .from("communities")
    .select("*")
    .order("created_at");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Platform · Communities</h1>
        <p className="text-sm text-gray-500">
          Internal tenant administration. Not exposed to residents.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Timezone</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {((communities ?? []) as Community[]).map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-semibold text-gray-900">{c.name}</td>
                <td className="px-4 py-3 font-mono text-gray-500">{c.slug}</td>
                <td className="px-4 py-3 text-gray-500">{c.timezone}</td>
                <td className="px-4 py-3 capitalize text-gray-500">{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
