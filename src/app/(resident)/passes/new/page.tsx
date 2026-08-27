import { requireAuthorizedContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/db/client";
import { authorizedUnitIds } from "@/lib/permissions";
import { RequestPassForm } from "@/components/resident/RequestPassForm";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ParkingRuleSet, Unit } from "@/lib/db/types";

export const metadata = { title: "Request Pass" };

export default async function RequestPassPage() {
  const ctx = await requireAuthorizedContext();
  const supabase = await createServerSupabase();
  const unitIds = authorizedUnitIds(ctx);

  if (unitIds.length === 0) {
    return (
      <EmptyState
        title="No residence linked to your account"
        description="Contact your community administrator to associate your account with a unit."
      />
    );
  }

  const residentMembership = ctx.memberships.find(
    (m) => m.role === "resident" && m.unit_id
  )!;

  const [{ data: units }, { data: rules }, { data: allowanceGrants }] = await Promise.all([
    supabase.from("units").select("*").in("id", unitIds),
    supabase
      .from("parking_rule_sets")
      .select("*")
      .eq("community_id", residentMembership.community_id)
      .single(),
    supabase
      .from("pass_allowance_grants")
      .select("additional_passes")
      .eq("community_id", residentMembership.community_id)
      .eq("user_id", ctx.userId)
      .gt("expires_at", new Date().toISOString()),
  ]);

  const r = rules as ParkingRuleSet | null;
  const monthlyAllowanceBonus = (allowanceGrants ?? []).reduce(
    (total, grant) => total + grant.additional_passes,
    0
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Request a temporary pass</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your community reviews these limits automatically — if the request fits the
          rules, your pass is issued instantly.
        </p>
      </div>

      {r && (
        <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800 ring-1 ring-brand-100">
          Passes may last up to <strong>{r.max_duration_hours} hours</strong>, be
          requested up to <strong>{r.advance_window_days} days</strong> in advance, with
          at most <strong>{r.max_active_passes} active</strong> at a time and{" "}
          <strong>{r.monthly_limit + monthlyAllowanceBonus} per rolling 30 days</strong>
          {monthlyAllowanceBonus > 0 && (
            <> ({r.monthly_limit} standard + {monthlyAllowanceBonus} approved)</>
          )}
          .
        </div>
      )}

      <Card>
        <CardHeader title="Guest vehicle details" />
        <CardBody>
          <RequestPassForm units={(units ?? []) as Unit[]} rules={r} />
        </CardBody>
      </Card>
    </div>
  );
}
