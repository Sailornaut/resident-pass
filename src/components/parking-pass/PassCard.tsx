import Link from "next/link";
import { StatusChip } from "@/components/ui/StatusChip";
import { effectiveStatus } from "@/lib/parking-rules/status";
import { formatValidityWindow } from "@/lib/format";
import type { ParkingPass } from "@/lib/db/types";

export function PassCard({
  pass,
  timezone,
  href,
}: {
  pass: ParkingPass;
  timezone: string;
  href?: string;
}) {
  const status = effectiveStatus(pass);
  const inner = (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 transition hover:ring-brand-600/40">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold tracking-wide text-gray-900">
            {pass.plate}
          </span>
          <span className="text-xs font-medium text-gray-500">{pass.plate_state}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-gray-500">
          {formatValidityWindow(pass.valid_from, pass.valid_until, timezone)}
        </p>
        <p className="mt-0.5 font-mono text-xs text-gray-400">{pass.public_code}</p>
      </div>
      <StatusChip status={status} />
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}
