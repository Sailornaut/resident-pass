import { AppShell } from "@/components/ui/AppShell";
import { requireAuthorizedContext } from "@/lib/auth";

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
  return (
    <AppShell navItems={NAV} userEmail={ctx.profile?.email} roleLabel="Resident">
      {children}
    </AppShell>
  );
}
