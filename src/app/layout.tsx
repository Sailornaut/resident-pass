import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ResidentPass",
    template: "%s · ResidentPass",
  },
  description:
    "Temporary guest parking passes for residential communities — request, print, and verify in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <p className="no-print pointer-events-none fixed bottom-3 left-3 z-50 select-none text-xs font-medium text-slate-500/45">
          ResidentPass by TrafficScout
        </p>
      </body>
    </html>
  );
}
