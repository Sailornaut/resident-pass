import { AppShell } from "@/components/ui/AppShell";
import { AccessRequestForm } from "@/components/resident/AccessRequestForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireAuthorizedContext } from "@/lib/auth";
import { createAdminSupabase, createServerSupabase } from "@/lib/db/client";
import type { Community } from "@/lib/db/types";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/passes", label: "My Passes" },
  { href: "/passes/new", label: "Request Pass" },
];

export default async function ResidentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAuthorizedContext();
  const hasLinkedResidence = ctx.memberships.some(
    (membership) => membership.role === "resident" && membership.unit_id
  );

  if (!hasLinkedResidence) {
    const supabase = await createServerSupabase();
    const { data: requestsByUser } = await supabase
      .from("user_access_requests")
      .select("id")
      .eq("requester_user_id", ctx.userId)
      .eq("status", "pending")
      .limit(1);
    let pendingRequests = requestsByUser ?? [];
    if (pendingRequests.length === 0 && ctx.profile?.email) {
      const { data: requestsByEmail } = await supabase
        .from("user_access_requests")
        .select("id")
        .eq("email", ctx.profile.email.toLowerCase())
        .eq("status", "pending")
        .limit(1);
      pendingRequests = requestsByEmail ?? [];
    }

    const admin = createAdminSupabase();
    const { data: communities } = await admin
      .from("communities")
      .select("id, name")
      .eq("status", "active")
      .order("name");
    const hasPendingRequest = (pendingRequests?.length ?? 0) > 0;

    return (
      <AppShell
        navItems={[]}
        userEmail={ctx.profile?.email}
        roleLabel="Account not linked"
      >
        <EmptyState
          title="Account not linked to a residence"
          description={
            hasPendingRequest
              ? "Your access request was sent and is waiting for a community administrator to review. You will be able to request passes after they link your account to a unit."
              : "You are signed in, but your account is not associated with a community and unit. Send your details to your property manager for review."
          }
          action={hasPendingRequest ? undefined : (
            <AccessRequestForm
              communities={(communities ?? []) as Array<Pick<Community, "id" | "name">>}
              defaultName={ctx.profile?.full_name ?? ""}
              defaultEmail={ctx.profile?.email ?? ""}
            />
          )}
        />
      </AppShell>
    );
  }

  return (
    <AppShell navItems={NAV} userEmail={ctx.profile?.email} roleLabel="Resident">
      {children}
    </AppShell>
  );
}
