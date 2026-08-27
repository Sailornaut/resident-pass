import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { requireAuthorizedContext } from "@/lib/auth";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/passes", label: "Passes" },
  { href: "/admin/units", label: "Units & Residents" },
  { href: "/admin/rules", label: "Parking Rules" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAuthorizedContext();

  const isAdmin = ctx.memberships.some(
    (m) => m.role === "admin" || m.role === "platform_admin"
  );
  if (!isAdmin) redirect("/dashboard");

  return (
    <AppShell navItems={NAV} userEmail={ctx.profile?.email} roleLabel="Administrator">
      {children}
    </AppShell>
  );
}
