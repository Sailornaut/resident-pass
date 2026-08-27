/**
 * Printable pass — intentionally high-contrast, mostly monochrome so it
 * remains legible on inexpensive black-and-white home printers and can be
 * read through a windshield. The database, not this paper, is the source
 * of truth: the QR/pass ID always reflect current status when verified.
 */

import { formatDateTime } from "@/lib/format";
import type { ParkingPass } from "@/lib/db/types";

export function PrintablePass({
  pass,
  communityName,
  timezone,
  qrDataUrl,
}: {
  pass: ParkingPass;
  communityName: string;
  timezone: string;
  qrDataUrl: string;
}) {
  return (
    <div className="print-page mx-auto max-w-md rounded-xl border-4 border-black bg-white p-6 text-black shadow-lg">
      {/* Header */}
      <div className="border-b-4 border-black pb-3 text-center">
        <p className="text-sm font-bold uppercase tracking-widest">{communityName}</p>
        <h1 className="mt-1 text-2xl font-black uppercase tracking-tight">
          Temporary Parking Pass
        </h1>
      </div>

      {/* Plate — very large type, primary visual element */}
      <div className="border-b-2 border-black py-5 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-700">
          Vehicle Plate
        </p>
        <p className="font-mono text-5xl font-black tracking-widest">{pass.plate}</p>
        <p className="mt-1 text-sm font-bold">{pass.plate_state}</p>
      </div>

      {/* Validity window — prominent */}
      <div className="grid grid-cols-2 gap-4 border-b-2 border-black py-4 text-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-700">
            Valid From
          </p>
          <p className="mt-1 text-sm font-bold leading-snug">
            {formatDateTime(pass.valid_from, timezone)}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-700">
            Valid Until
          </p>
          <p className="mt-1 text-sm font-bold leading-snug">
            {formatDateTime(pass.valid_until, timezone)}
          </p>
        </div>
      </div>

      {/* QR + pass ID */}
      <div className="flex flex-col items-center py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt={`QR verification code for pass ${pass.public_code}`} className="h-52 w-52" />
        <p className="mt-2 font-mono text-2xl font-black tracking-widest">
          {pass.public_code}
        </p>
      </div>

      {/* Verification statement */}
      <p className="border-t-2 border-black pt-3 text-center text-xs font-medium leading-relaxed">
        Scan QR or enter Pass ID to verify current status.
        <br />
        This pass may be revoked at any time. Validity is determined by the
        verification system, not this printout.
      </p>
    </div>
  );
}
