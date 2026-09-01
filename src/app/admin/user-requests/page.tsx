import Link from "next/link";
import { requireAuthorizedContext } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/db/client";
import { formatDateTime } from "@/lib/format";
import { resolveAdminCommunity } from "@/server/services/admin-context";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { UserAccessRequest } from "@/lib/db/types";

export const metadata = { title: "User Requests" };

export default async function UserRequestsPage() {
  const ctx = await requireAuthorizedContext();
  const community = await resolveAdminCommunity(ctx);
  const admin = createAdminSupabase();
  const { data: requests } = await admin
    .from("user_access_requests")
    .select("*")
    .eq("community_id", community.id)
    .order("created_at", { ascending: false });

  const allRequests = (requests ?? []) as UserAccessRequest[];
  const pendingRequests = allRequests.filter((request) => request.status === "pending");
  const previousRequests = allRequests.filter((request) => request.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User requests</h1>
        <p className="text-sm text-gray-500">
          Access requests for {community.name}. Requests do not grant access automatically.
        </p>
      </div>

      <Card>
        <CardHeader
          title={`Pending (${pendingRequests.length})`}
          subtitle="Verify each resident before assigning or inviting them to a unit."
          action={
            <Link
              href="/admin/units"
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              Manage residents →
            </Link>
          }
        />
        <CardBody>
          {pendingRequests.length === 0 ? (
            <EmptyState
              title="No pending user requests"
              description="New access requests for this community will appear here and on the notification bell."
            />
          ) : (
            <RequestTable requests={pendingRequests} timezone={community.timezone} />
          )}
        </CardBody>
      </Card>

      {previousRequests.length > 0 && (
        <Card>
          <CardHeader title="Request history" />
          <CardBody>
            <RequestTable requests={previousRequests} timezone={community.timezone} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function RequestTable({
  requests,
  timezone,
}: {
  requests: UserAccessRequest[];
  timezone: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2">Resident</th>
            <th className="px-3 py-2">Requested unit</th>
            <th className="px-3 py-2">Message</th>
            <th className="px-3 py-2">Received</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {requests.map((request) => (
            <tr key={request.id}>
              <td className="px-3 py-3">
                <p className="font-semibold text-gray-900">
                  {request.full_name || request.email}
                </p>
                {request.full_name && <p className="text-gray-500">{request.email}</p>}
              </td>
              <td className="px-3 py-3 font-medium text-gray-900">
                {request.requested_unit_label}
              </td>
              <td className="max-w-xs px-3 py-3 text-gray-500">
                {request.note || "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-gray-500">
                {formatDateTime(request.created_at, timezone)}
              </td>
              <td className="px-3 py-3">
                <span className={request.status === "pending"
                  ? "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
                  : "rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold capitalize text-gray-600"
                }>
                  {request.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
