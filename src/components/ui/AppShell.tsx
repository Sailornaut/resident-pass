import Link from "next/link";
import type { ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
}

export function AppShell({
  navItems,
  userEmail,
  roleLabel,
  headerActions,
  children,
}: {
  navItems: NavItem[];
  userEmail?: string;
  roleLabel?: string;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                RP
              </span>
              <span className="text-base font-semibold text-gray-900">
                {process.env.NEXT_PUBLIC_APP_NAME ?? "ResidentPass"}
              </span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {headerActions}
            {roleLabel && (
              <span className="hidden rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 sm:inline-flex">
                {roleLabel}
              </span>
            )}
            {userEmail && (
              <span className="hidden text-sm text-gray-500 md:inline">{userEmail}</span>
            )}
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-t border-gray-100 px-4 py-2 sm:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
