import { requireAuthorizedContext } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/db/client";
import { resolveAdminCommunity } from "@/server/services/admin-context";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { CreateUnitForm } from "@/components/admin/CreateUnitForm";
import { AddResidentForm } from "@/components/admin/AddResidentForm";
import { AllowanceGrantForm } from "@/components/admin/AllowanceGrantForm";
import { formatDateTime } from "@/lib/format";
import type { Membership, PassAllowanceGrant, Unit, User } from "@/lib/db/types";

export const metadata = { title: "Units & Residents" };

export default async function AdminUnitsPage() {
  const ctx = await requireAuthorizedContext();
  const community = await resolveAdminCommunity(ctx);
  const admin = createAdminSupabase();

  const [{ data: units }, { data: memberships }, { data: allowanceGrants }] = await Promise.all([
    admin
      .from("units")
      .select("*")
      .eq("community_id", community.id)
      .order("unit_label"),
    admin
      .from("memberships")
      .select("*, users(full_name, email)")
      .eq("community_id", community.id)
      .eq("role", "resident"),
    admin
      .from("pass_allowance_grants")
      .select("*")
      .eq("community_id", community.id)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true }),
  ]);

  const allUnits = (units ?? []) as Unit[];
  type ResidentMembership = Membership & {
    users: Pick<User, "full_name" | "email">;
  };
  const residentMemberships = (memberships ?? []) as ResidentMembership[];
  const activeResidentMemberships = residentMemberships.filter(
    (resident) => resident.status === "active"
  );
  const activeGrants = (allowanceGrants ?? []) as PassAllowanceGrant[];
  const residentsByUnit = new Map<string, ResidentMembership[]>();
  for (const m of residentMemberships) {
    if (!m.unit_id) continue;
    const list = residentsByUnit.get(m.unit_id) ?? [];
    list.push(m);
    residentsByUnit.set(m.unit_id, list);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Units &amp; residents</h1>

      <Card>
        <CardHeader title="Add a unit" />
        <CardBody>
          <CreateUnitForm communityId={community.id} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Assign or invite a resident"
          subtitle="Assign an existing account, or email a new resident an account invitation"
        />
        <CardBody>
          <AddResidentForm communityId={community.id} units={allUnits} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Resident pass allowances"
          subtitle="Approve temporary passes above the community's rolling 30-day limit"
        />
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-2">
            {activeResidentMemberships.map((resident) => {
              const unit = allUnits.find((candidate) => candidate.id === resident.unit_id);
              const residentName = resident.users?.full_name ?? resident.users?.email;
              const grants = activeGrants.filter(
                (grant) => grant.user_id === resident.user_id
              );
              const approvedExtra = grants.reduce(
                (total, grant) => total + grant.additional_passes,
                0
              );

              return (
                <section
                  key={resident.id}
                  className="space-y-3 rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{residentName}</h3>
                      <p className="text-sm text-gray-500">
                        {resident.users?.email} · Unit {unit?.unit_label ?? "—"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                      +{approvedExtra} active
                    </span>
                  </div>

                  {grants.length > 0 && (
                    <ul className="space-y-1 text-xs text-gray-500">
                      {grants.map((grant) => (
                        <li key={grant.id}>
                          +{grant.additional_passes} until{" "}
                          {formatDateTime(grant.expires_at, community.timezone)}
                          {grant.reason ? ` — ${grant.reason}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}

                  <AllowanceGrantForm
                    communityId={community.id}
                    userId={resident.user_id}
                    residentName={residentName}
                  />
                </section>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`Units (${allUnits.length})`}
          subtitle="Residents are associated with units by community administrators"
        />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2">Residents</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allUnits.map((unit) => {
                  const residents = residentsByUnit.get(unit.id) ?? [];
                  return (
                    <tr key={unit.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-semibold text-gray-900">
                        {unit.unit_label}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500">
                        {unit.address_label ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        {residents.length === 0 ? (
                          <span className="text-gray-400">No residents</span>
                        ) : (
                            residents
                            .map((r) => {
                              const name = r.users?.full_name ?? r.users?.email;
                              return r.status === "invited" ? `${name} (invited)` : name;
                            })
                            .join(", ")
                        )}
                      </td>
                      <td className="px-3 py-2.5 capitalize text-gray-500">{unit.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
