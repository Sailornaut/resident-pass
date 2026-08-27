/**
 * /verify — landing page for manual pass ID entry (no code in the URL).
 */

import { ManualCodeEntry } from "@/components/parking-pass/ManualCodeEntry";

export const metadata = { title: "Verify Pass" };

export default function VerifyLandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="bg-brand-600 px-4 py-12 text-center text-white">
        <p className="text-sm font-semibold uppercase tracking-widest opacity-80">
          ResidentPass
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Verify a Pass</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm opacity-90">
          Scan the QR code on a pass, or enter its ID below.
        </p>
      </div>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <ManualCodeEntry />
      </main>
    </div>
  );
}
