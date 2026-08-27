import Link from "next/link";
import { requireAuthorizedContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/db/client";
import { authorizedUnitIds } from "@/lib/permissions";
import { effectiveStatus } from "@/lib/parking-rules/status";
import { PassCard } from "@/components/parking-pass/PassCard";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Community, ParkingPass, ParkingRuleSet, Unit } from "@/lib/db/types";

export const metadata = { title: "Dashboard" };

export default async function ResidentDashboard() {
  const ctx = await requireAuthorizedContext();
  const supabase = await createServerSupabase();
  const unitIds = authorizedUnitIds(ctx);

  const residentMembership = ctx.memberships.find(
    (m) => m.role === "resident" && m.unit_id
  );

  if (!residentMembership) {
    return (
      <EmptyState
        title="No residence linked to your account"
        description="Your account is not yet associated with a unit. Contact your community administrator to get set up."
      />
    );
  }

  const [
    { data: community },
    { data: unit },
    { data: rules },
    { data: passes },
    { data: allowanceGrants },
  ] =
    await Promise.all([
      supabase
        .from("communities")
        .select("*")
        .eq("id", residentMembership.community_id)
        .single(),
      supabase.from("units").select("*").eq("id", residentMembership.unit_id!).single(),
      supabase
        .from("parking_rule_sets")
        .select("*")
        .eq("community_id", residentMembership.community_id)
        .single(),
      supabase
        .from("parking_passes")
        .select("*")
        .in("unit_id", unitIds)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("pass_allowance_grants")
        .select("additional_passes")
        .eq("community_id", residentMembership.community_id)
        .eq("user_id", ctx.userId)
        .gt("expires_at", new Date().toISOString()),
    ]);

  const c = community as Community | null;
  const u = unit as Unit | null;
  const r = rules as ParkingRuleSet | null;
  const allPasses = (passes ?? []) as ParkingPass[];
  const monthlyAllowanceBonus = (allowanceGrants ?? []).reduce(
    (total, grant) => total + grant.additional_passes,
    0
  );

  const livePasses = allPasses.filter((p) => {
    const s = effectiveStatus(p);
    return s === "active" || s === "not_yet_valid";
  });
  const recentPasses = allPasses
    .filter((p) => !livePasses.some((lp) => lp.id === p.id))
    .slice(0, 5);

  const activeCount = livePasses.length;
  const remaining = r ? Math.max(0, r.max_active_passes - activeCount) : 0;

  return (
    <div className="space-y-6">
      {/* Header + primary CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{c?.name}</h1>
          <p className="text-sm text-gray-500">
            Unit {u?.unit_label}
            {u?.address_label ? ` · ${u.address_label}` : ""}
          </p>
        </div>
        <Link
          href="/passes/new"
          className="inline-flex items-center rounded-lg bg-brand-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Request Temporary Pass
        </Link>
      </div>

      {/* Allowance summary */}
      {r && (
        <Card>
          <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Active passes
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {activeCount}
                <span className="text-base font-medium text-gray-400">
                  {" "}/ {r.max_active_passes}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Remaining now
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{remaining}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Max duration
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {r.max_duration_hours}
                <span className="text-base font-medium text-gray-400"> hrs</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                30-day allowance
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {r.monthly_limit + monthlyAllowanceBonus}
              </p>
              {monthlyAllowanceBonus > 0 && (
                <p className="text-xs font-medium text-brand-700">
                  +{monthlyAllowanceBonus} approved
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Active passes */}
      <Card>
        <CardHeader
          title="Active & upcoming passes"
          subtitle="Passes currently valid or scheduled to start"
        />
        <CardBody className="space-y-3">
          {livePasses.length === 0 ? (
            <EmptyState
              title="No active passes"
              description="Request a temporary pass for your next guest."
              action={
                <Link
                  href="/passes/new"
                  className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                  Request a pass →
                </Link>
              }
            />
          ) : (
            livePasses.map((pass) => (
              <PassCard
                key={pass.id}
                pass={pass}
                timezone={c?.timezone ?? "America/New_York"}
                href={`/passes/${pass.id}/confirmation`}
              />
            ))
          )}
        </CardBody>
      </Card>

      {/* Recent history */}
      {recentPasses.length > 0 && (
        <Card>
          <CardHeader title="Recent history" />
          <CardBody className="space-y-3">
            {recentPasses.map((pass) => (
              <PassCard
                key={pass.id}
                pass={pass}
                timezone={c?.timezone ?? "America/New_York"}
              />
            ))}
            <div className="pt-1 text-right">
              <Link
                href="/passes"
                className="text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                View all passes →
              </Link>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
