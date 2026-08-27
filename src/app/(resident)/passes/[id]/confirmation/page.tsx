import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthorizedContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/db/client";
import { effectiveStatus, isCancellable } from "@/lib/parking-rules/status";
import { formatDateTime } from "@/lib/format";
import { generateQrDataUrl } from "@/lib/qr";
import { StatusChip } from "@/components/ui/StatusChip";
import { Card, CardBody } from "@/components/ui/Card";
import { CancelPassButton } from "@/components/resident/CancelPassButton";
import type { Community, ParkingPass, ParkingRuleSet } from "@/lib/db/types";

export const metadata = { title: "Pass Confirmation" };

export default async function PassConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuthorizedContext();
  const supabase = await createServerSupabase();

  // RLS restricts this query to passes the caller may see.
  const { data: pass } = await supabase
    .from("parking_passes")
    .select("*, communities(*)")
    .eq("id", id)
    .maybeSingle();

  if (!pass) notFound();

  const p = pass as ParkingPass & { communities: Community };
  const timezone = p.communities?.timezone ?? "America/New_York";
  const status = effectiveStatus(p);
  const qrDataUrl = await generateQrDataUrl(p.public_code);

  const { data: rules } = await supabase
    .from("parking_rule_sets")
    .select("*")
    .eq("community_id", p.community_id)
    .single();
  const cancellable = isCancellable(
    p,
    (rules as ParkingRuleSet | null)?.allow_resident_cancel ?? true
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Success banner for fresh issuance */}
      {(status === "active" || status === "not_yet_valid") && (
        <div className="rounded-xl bg-green-50 px-5 py-4 ring-1 ring-green-200">
          <h1 className="text-lg font-bold text-green-900">Your pass is ready</h1>
          <p className="mt-0.5 text-sm text-green-800">
            Print it or save it as a PDF and place it on the guest vehicle&apos;s dashboard.
          </p>
        </div>
      )}

      <Card>
        <CardBody className="space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Pass ID
              </p>
              <p className="font-mono text-2xl font-bold tracking-widest text-gray-900">
                {p.public_code}
              </p>
            </div>
            <StatusChip status={status} />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Plate
              </p>
              <p className="mt-0.5 font-mono text-lg font-bold">{p.plate}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                State
              </p>
              <p className="mt-0.5 text-lg font-semibold">{p.plate_state}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Community
              </p>
              <p className="mt-0.5 text-lg font-semibold">{p.communities?.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Valid from
              </p>
              <p className="mt-0.5 font-semibold">{formatDateTime(p.valid_from, timezone)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Valid until
              </p>
              <p className="mt-0.5 font-semibold">{formatDateTime(p.valid_until, timezone)}</p>
            </div>
          </div>

          {p.guest_name && (
            <p className="border-t border-gray-100 pt-4 text-sm text-gray-600">
              Guest: <span className="font-medium text-gray-900">{p.guest_name}</span>
            </p>
          )}

          <div className="flex flex-col items-center border-t border-gray-100 pt-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR verification code" className="h-40 w-40" />
            <p className="mt-2 text-xs text-gray-500">
              Enforcement scans this code to verify the pass.
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <Link
            href={`/passes/${p.id}/print`}
            className="inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Print / Save as PDF
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Back to dashboard
          </Link>
        </div>
        {cancellable && <CancelPassButton passId={p.id} />}
      </div>
    </div>
  );
}
