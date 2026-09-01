import { requireAuthorizedContext } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/db/client";
import { resolveAdminCommunity } from "@/server/services/admin-context";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserRequestTable } from "@/components/admin/UserRequestInbox";
import type { Unit, UserAccessRequest } from "@/lib/db/types";

export const metadata = { title: "User Requests" };

export default async function UserRequestsPage() {
  const ctx = await requireAuthorizedContext();
  const community = await resolveAdminCommunity(ctx);
  const admin = createAdminSupabase();
  const [{ data: requests }, { data: units }] = await Promise.all([
    admin
      .from("user_access_requests")
      .select("*")
      .eq("community_id", community.id)
      .order("created_at", { ascending: false }),
    admin
      .from("units")
      .select("*")
      .eq("community_id", community.id)
      .eq("status", "active")
      .order("unit_label"),
  ]);

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
        />
        <CardBody>
          {pendingRequests.length === 0 ? (
            <EmptyState
              title="No pending user requests"
              description="New access requests for this community will appear here and on the notification bell."
            />
          ) : (
            <UserRequestTable
              requests={pendingRequests}
              units={(units ?? []) as Unit[]}
              community={community}
            />
          )}
        </CardBody>
      </Card>

      {previousRequests.length > 0 && (
        <Card>
          <CardHeader title="Request history" />
          <CardBody>
            <UserRequestTable
              requests={previousRequests}
              units={(units ?? []) as Unit[]}
              community={community}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
