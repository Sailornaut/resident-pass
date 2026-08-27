import { requireAuthorizedContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/db/client";
import { resolveAdminCommunity } from "@/server/services/admin-context";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { RulesForm } from "@/components/admin/RulesForm";
import type { ParkingRuleSet } from "@/lib/db/types";

export const metadata = { title: "Parking Rules" };

export default async function AdminRulesPage() {
  const ctx = await requireAuthorizedContext();
  const community = await resolveAdminCommunity(ctx);
  const supabase = await createServerSupabase();

  const { data: rules } = await supabase
    .from("parking_rule_sets")
    .select("*")
    .eq("community_id", community.id)
    .single();

  if (!rules) {
    return (
      <p className="text-sm text-gray-500">
        No rule set configured for this community yet. Run the seed script or contact
        platform support.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Parking rules</h1>
        <p className="mt-1 text-sm text-gray-500">
          Limits are enforced automatically before any pass is issued for {community.name}.
        </p>
      </div>

      <Card>
        <CardHeader title="Issuance limits" />
        <CardBody>
          <RulesForm communityId={community.id} rules={rules as ParkingRuleSet} />
        </CardBody>
      </Card>
    </div>
  );
}
