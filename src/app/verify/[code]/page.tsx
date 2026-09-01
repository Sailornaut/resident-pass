/**
 * Public verification page — the QR code destination.
 *
 * Design constraints (from the MVP brief):
 * - Must be readable outdoors on a phone in seconds.
 * - Full-width status treatment dominates the page.
 * - Shows ONLY enforcement-relevant data: community, plate, state,
 *   validity window. Never resident identity.
 * - No login required.
 */

import { verifyByPublicCode } from "@/server/services/pass-service";
import { formatDateTime } from "@/lib/format";
import { ManualCodeEntry } from "@/components/parking-pass/ManualCodeEntry";

export const metadata = { title: "Verify Pass" };
export const dynamic = "force-dynamic";

const STATUS_UI: Record<
  string,
  { label: string; bg: string; text: string; detail: string }
> = {
  active: {
    label: "VALID",
    bg: "bg-green-600",
    text: "text-white",
    detail: "This pass is currently valid.",
  },
  not_yet_valid: {
    label: "NOT YET VALID",
    bg: "bg-blue-600",
    text: "text-white",
    detail: "This pass exists but its validity window has not started.",
  },
  expired: {
    label: "EXPIRED",
    bg: "bg-gray-700",
    text: "text-white",
    detail: "This pass's validity window has ended.",
  },
  revoked: {
    label: "REVOKED",
    bg: "bg-red-600",
    text: "text-white",
    detail: "This pass was revoked by the community and is no longer valid.",
  },
  cancelled: {
    label: "CANCELLED",
    bg: "bg-amber-500",
    text: "text-white",
    detail: "This pass was cancelled by the resident.",
  },
  not_found: {
    label: "NOT FOUND",
    bg: "bg-red-600",
    text: "text-white",
    detail: "No pass exists with this ID. Check the code and try again.",
  },
};

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const result = await verifyByPublicCode(decodeURIComponent(code));
  const ui = STATUS_UI[result.status] ?? STATUS_UI.not_found;
  const timezone = result.community_timezone ?? "America/New_York";

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Dominant full-width status banner */}
      <div className={`${ui.bg} ${ui.text} px-4 py-12 text-center`}>
        <p className="text-sm font-semibold uppercase tracking-widest opacity-80">
          Parking pass status
        </p>
        <h1 className="mt-2 text-5xl font-black tracking-tight sm:text-6xl">
          {ui.label}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm opacity-90">{ui.detail}</p>
      </div>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        {result.status !== "not_found" ? (
          <div className="space-y-4">
            {result.recently_verified && (
              <div className="rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
                Recently verified — confirm this pass is being used with the correct
                vehicle.
              </div>
            )}
            <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <Row label="Community" value={result.community_name ?? "—"} />
              <Row
                label="Vehicle plate"
                value={`${result.plate ?? "—"} (${result.plate_state || "—"})`}
                mono
              />
              {result.valid_from && (
                <Row label="Valid from" value={formatDateTime(result.valid_from, timezone)} />
              )}
              {result.valid_until && (
                <Row label="Valid until" value={formatDateTime(result.valid_until, timezone)} />
              )}
              <Row label="Pass ID" value={result.public_code ?? "—"} mono />
              {result.scan_count !== undefined && (
                <Row label="Verification count" value={String(result.scan_count)} />
              )}
              <Row
                label="Previous verification"
                value={
                  result.previous_scan_at
                    ? formatDateTime(result.previous_scan_at, timezone)
                    : "No previous verifications"
                }
              />
            </div>
          </div>
        ) : (
          <ManualCodeEntry initialValue={decodeURIComponent(code)} />
        )}

        <p className="mt-8 text-center text-xs text-gray-400">
          Status reflects the live system record, including revocations.
          <br />
          Times shown in {timezone}.
        </p>
      </main>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span
        className={`text-right text-sm font-semibold text-gray-900 ${mono ? "font-mono tracking-wider" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
