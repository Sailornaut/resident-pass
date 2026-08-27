import Link from "next/link";
import { requireAuthorizedContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/db/client";
import { resolveAdminCommunity } from "@/server/services/admin-context";
import { effectiveStatus } from "@/lib/parking-rules/status";
import { formatValidityWindow } from "@/lib/format";
import { StatusChip } from "@/components/ui/StatusChip";
import type { ParkingPass, Unit } from "@/lib/db/types";

export const metadata = { title: "Pass Management" };

const STATUS_FILTERS = ["all", "active", "scheduled", "expired", "revoked", "cancelled"] as const;

export default async function AdminPassesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "all" } = await searchParams;
  const ctx = await requireAuthorizedContext();
  const community = await resolveAdminCommunity(ctx);
  const supabase = await createServerSupabase();

  let query = supabase
    .from("parking_passes")
    .select("*, units(unit_label)")
    .eq("community_id", community.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) {
    // Search by public code or plate (unit search resolves below)
    query = query.or(`public_code.ilike.%${q}%,plate.ilike.%${q}%`);
  }

  const { data: passes } = await query;
  let results = (passes ?? []) as (ParkingPass & { units: Pick<Unit, "unit_label"> })[];

  if (status !== "all") {
    results = results.filter((p) =>
      status === "scheduled"
        ? effectiveStatus(p) === "not_yet_valid"
        : effectiveStatus(p) === status
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Pass management</h1>
        <p className="text-sm text-gray-500">{results.length} passes</p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex-1" action="/admin/passes" method="get">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by pass ID or plate…"
            className="block w-full max-w-md rounded-lg border-0 px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-brand-600"
          />
          {status !== "all" && <input type="hidden" name="status" value={status} />}
        </form>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s}
              href={`/admin/passes?${new URLSearchParams({ ...(q ? { q } : {}), ...(s !== "all" ? { status: s } : {}) })}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                status === s
                  ? "bg-brand-600 text-white"
                  : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Pass ID</th>
              <th className="px-4 py-3">Plate</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Validity</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No passes match your search.
                </td>
              </tr>
            ) : (
              results.map((pass) => (
                <tr key={pass.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/passes/${pass.id}`}
                      className="font-mono font-semibold text-brand-600 hover:text-brand-700"
                    >
                      {pass.public_code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {pass.plate}{" "}
                    <span className="text-xs text-gray-400">{pass.plate_state}</span>
                  </td>
                  <td className="px-4 py-3">{pass.units?.unit_label ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatValidityWindow(pass.valid_from, pass.valid_until, community.timezone)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={effectiveStatus(pass)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
