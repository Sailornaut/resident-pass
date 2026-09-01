import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuthorizedContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/db/client";
import { generateQrDataUrl } from "@/lib/qr";
import { effectiveStatus } from "@/lib/parking-rules/status";
import { PrintablePass } from "@/components/parking-pass/PrintablePass";
import { PrintButton } from "@/components/parking-pass/PrintButton";
import type { Community, ParkingPass } from "@/lib/db/types";

export const metadata = { title: "Print Pass" };

export default async function PrintPassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuthorizedContext();
  const supabase = await createServerSupabase();

  const { data: pass } = await supabase
    .from("parking_passes")
    .select("*, communities(*)")
    .eq("id", id)
    .maybeSingle();

  if (!pass) notFound();

  const p = pass as ParkingPass & { communities: Community };
  const status = effectiveStatus(p);
  const printable = status !== "revoked" && status !== "cancelled";
  const qrDataUrl = await generateQrDataUrl(p.public_code);

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div className="no-print flex items-center justify-between">
        <Link
          href={`/passes/${p.id}/confirmation`}
          className="text-sm font-semibold text-gray-600 hover:text-gray-900"
        >
          ← Back to pass
        </Link>
        {printable && <PrintButton />}
      </div>

      {!printable && (
        <div className="no-print rounded-lg bg-gray-100 px-4 py-3 text-center text-sm font-medium text-gray-700">
          This pass is {status}. Printing and saving are no longer available.
        </div>
      )}

      <PrintablePass
        pass={p}
        communityName={p.communities?.name ?? "Community"}
        timezone={p.communities?.timezone ?? "America/New_York"}
        qrDataUrl={qrDataUrl}
      />

      {printable && (
        <p className="no-print text-center text-xs text-gray-400">
          Tip: use your browser&apos;s print dialog to save as PDF. The pass prints in
          black and white on any home printer.
        </p>
      )}
    </div>
  );
}
