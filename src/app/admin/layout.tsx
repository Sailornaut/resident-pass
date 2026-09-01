import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { requireAuthorizedContext } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/db/client";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/passes", label: "Passes" },
  { href: "/admin/units", label: "Units & Residents" },
  { href: "/admin/user-requests", label: "User Requests" },
  { href: "/admin/rules", label: "Parking Rules" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAuthorizedContext();

  const adminMembership = ctx.memberships.find(
    (m) => m.role === "admin" || m.role === "platform_admin"
  );
  if (!adminMembership) redirect("/dashboard");

  const admin = createAdminSupabase();
  const { count: pendingRequestCount } = await admin
    .from("user_access_requests")
    .select("id", { count: "exact", head: true })
    .eq("community_id", adminMembership.community_id)
    .eq("status", "pending");

  const requestCount = pendingRequestCount ?? 0;
  const bellLabel = requestCount === 0
    ? "No pending user requests"
    : `${requestCount} pending user request${requestCount === 1 ? "" : "s"}`;

  return (
    <AppShell
      navItems={NAV}
      userEmail={ctx.profile?.email}
      roleLabel="Administrator"
      headerActions={
        <Link
          href="/admin/user-requests"
          aria-label={bellLabel}
          title={bellLabel}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-5 w-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.86 17.08a24.9 24.9 0 0 1 5.45 1.31A8.97 8.97 0 0 1 18 12.35V9.75a6 6 0 0 0-12 0v2.6a8.97 8.97 0 0 1-2.31 6.04 24.9 24.9 0 0 1 5.45-1.31m5.72 0a3 3 0 1 1-5.72 0m5.72 0a24.9 24.9 0 0 0-5.72 0" />
          </svg>
          {requestCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
              {requestCount > 99 ? "99+" : requestCount}
            </span>
          )}
        </Link>
      }
    >
      {children}
    </AppShell>
  );
}
