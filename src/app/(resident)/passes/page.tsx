import Link from "next/link";
import { requireAuthorizedContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/db/client";
import { authorizedUnitIds } from "@/lib/permissions";
import { effectiveStatus } from "@/lib/parking-rules/status";
import { PassCard } from "@/components/parking-pass/PassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Community, ParkingPass } from "@/lib/db/types";

export const metadata = { title: "My Passes" };

const SECTIONS = [
  { key: "active", title: "Active" },
  { key: "not_yet_valid", title: "Upcoming" },
  { key: "expired", title: "Expired" },
  { key: "revoked", title: "Revoked" },
  { key: "cancelled", title: "Cancelled" },
] as const;

export default async function MyPassesPage() {
  const ctx = await requireAuthorizedContext();
  const supabase = await createServerSupabase();
  const unitIds = authorizedUnitIds(ctx);

  const residentMembership = ctx.memberships.find((m) => m.role === "resident");

  const [{ data: passes }, { data: community }] = await Promise.all([
    supabase
      .from("parking_passes")
      .select("*")
      .in("unit_id", unitIds.length ? unitIds : ["00000000-0000-0000-0000-000000000000"])
      .order("valid_from", { ascending: false }),
    residentMembership
      ? supabase
          .from("communities")
          .select("*")
          .eq("id", residentMembership.community_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const allPasses = (passes ?? []) as ParkingPass[];
  const timezone = (community as Community | null)?.timezone ?? "America/New_York";

  const grouped = new Map<string, ParkingPass[]>();
  for (const pass of allPasses) {
    const status = effectiveStatus(pass);
    const list = grouped.get(status) ?? [];
    list.push(pass);
    grouped.set(status, list);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My passes</h1>
        <Link
          href="/passes/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Request Pass
        </Link>
      </div>

      {allPasses.length === 0 ? (
        <EmptyState
          title="No passes yet"
          description="When you request guest passes, they'll appear here."
        />
      ) : (
        SECTIONS.map(({ key, title }) => {
          const list = grouped.get(key);
          if (!list?.length) return null;
          return (
            <section key={key}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                {title} ({list.length})
              </h2>
              <div className="space-y-3">
                {list.map((pass) => (
                  <PassCard
                    key={pass.id}
                    pass={pass}
                    timezone={timezone}
                    href={`/passes/${pass.id}/confirmation`}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
