import Link from "next/link";
import { requireAuthorizedContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/db/client";
import { resolveAdminCommunity } from "@/server/services/admin-context";
import { effectiveStatus } from "@/lib/parking-rules/status";
import { PassCard } from "@/components/parking-pass/PassCard";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import type { ParkingPass } from "@/lib/db/types";

export const metadata = { title: "Admin Dashboard" };

export default async function AdminDashboard() {
  const ctx = await requireAuthorizedContext();
  const community = await resolveAdminCommunity(ctx);
  const supabase = await createServerSupabase();

  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const { data: passes } = await supabase
    .from("parking_passes")
    .select("*")
    .eq("community_id", community.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const all = (passes ?? []) as ParkingPass[];
  const active = all.filter((p) => effectiveStatus(p) === "active");
  const expiringToday = active.filter(
    (p) => new Date(p.valid_until) <= endOfDay
  );
  const recentIssued = all.filter((p) => new Date(p.created_at) >= sevenDaysAgo);
  const revoked = all.filter((p) => p.status === "revoked");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{community.name}</h1>
        <p className="text-sm text-gray-500">Community administration</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Active now" value={active.length} href="/admin/passes?status=active" />
        <Metric label="Expiring today" value={expiringToday.length} />
        <Metric label="Issued (7 days)" value={recentIssued.length} />
        <Metric label="Revoked" value={revoked.length} href="/admin/passes?status=revoked" />
      </div>

      <Card>
        <CardHeader
          title="Recently issued"
          action={
            <Link
              href="/admin/passes"
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              View all →
            </Link>
          }
        />
        <CardBody className="space-y-3">
          {recentIssued.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              No passes issued in the past 7 days.
            </p>
          ) : (
            recentIssued.slice(0, 8).map((pass) => (
              <PassCard
                key={pass.id}
                pass={pass}
                timezone={community.timezone}
                href={`/admin/passes/${pass.id}`}
              />
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200 transition hover:ring-brand-600/40">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
