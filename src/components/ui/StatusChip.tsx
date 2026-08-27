import type { EffectivePassStatus, PassStatus } from "@/lib/db/types";

type ChipStatus = EffectivePassStatus | PassStatus | "not_found";

const STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-green-100", text: "text-green-800", label: "Active" },
  scheduled: { bg: "bg-blue-100", text: "text-blue-800", label: "Scheduled" },
  not_yet_valid: { bg: "bg-blue-100", text: "text-blue-800", label: "Not Yet Valid" },
  expired: { bg: "bg-gray-100", text: "text-gray-600", label: "Expired" },
  revoked: { bg: "bg-red-100", text: "text-red-800", label: "Revoked" },
  cancelled: { bg: "bg-amber-100", text: "text-amber-800", label: "Cancelled" },
  not_found: { bg: "bg-red-100", text: "text-red-800", label: "Not Found" },
};

export function StatusChip({ status }: { status: ChipStatus }) {
  const style = STYLES[status] ?? STYLES.expired;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}
