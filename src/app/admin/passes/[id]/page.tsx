import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthorizedContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/db/client";
import { resolveAdminCommunity } from "@/server/services/admin-context";
import { effectiveStatus } from "@/lib/parking-rules/status";
import { formatDateTime } from "@/lib/format";
import { StatusChip } from "@/components/ui/StatusChip";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { RevokePassForm } from "@/components/admin/RevokePassForm";
import type { ParkingPass, PassEvent, Unit, User } from "@/lib/db/types";

export const metadata = { title: "Pass Detail" };

export default async function AdminPassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuthorizedContext();
  const community = await resolveAdminCommunity(ctx);
  const supabase = await createServerSupabase();

  // Scope to the admin's community — tenant isolation enforced server-side.
  const { data: pass } = await supabase
    .from("parking_passes")
    .select("*, units(unit_label, address_label), users!parking_passes_requester_user_id_fkey(full_name, email)")
    .eq("id", id)
    .eq("community_id", community.id)
    .maybeSingle();

  if (!pass) notFound();

  const p = pass as ParkingPass & {
    units: Pick<Unit, "unit_label" | "address_label">;
    users: Pick<User, "full_name" | "email">;
  };
  const status = effectiveStatus(p);

  const { data: events } = await supabase
    .from("pass_events")
    .select("*")
    .eq("pass_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/passes"
        className="text-sm font-semibold text-gray-500 hover:text-gray-900"
      >
        ← All passes
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-3xl font-bold tracking-widest text-gray-900">
            {p.public_code}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{community.name}</p>
        </div>
        <StatusChip status={status} />
      </div>

      <Card>
        <CardHeader title="Pass details" />
        <CardBody className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Detail label="Plate" value={`${p.plate} (${p.plate_state})`} mono />
          <Detail label="Unit" value={p.units?.unit_label ?? "—"} />
          <Detail
            label="Requested by"
            value={p.users?.full_name ?? p.users?.email ?? "—"}
          />
          <Detail label="Valid from" value={formatDateTime(p.valid_from, community.timezone)} />
          <Detail label="Valid until" value={formatDateTime(p.valid_until, community.timezone)} />
          <Detail label="Created" value={formatDateTime(p.created_at, community.timezone)} />
          {p.guest_name && <Detail label="Guest" value={p.guest_name} />}
          {p.vehicle_make && <Detail label="Vehicle" value={p.vehicle_make} />}
          {p.note && <Detail label="Note" value={p.note} />}
        </CardBody>
      </Card>

      {(status === "active" || status === "not_yet_valid") && (
        <RevokePassForm passId={p.id} />
      )}

      <Card>
        <CardHeader title="Audit history" subtitle="Immutable record of all pass events" />
        <CardBody>
          {(events ?? []).length === 0 ? (
            <p className="py-2 text-sm text-gray-500">No events recorded.</p>
          ) : (
            <ol className="space-y-3">
              {((events ?? []) as PassEvent[]).map((event) => (
                <li key={event.id} className="flex items-baseline gap-3 text-sm">
                  <span className="w-40 shrink-0 text-xs text-gray-400">
                    {formatDateTime(event.created_at, community.timezone)}
                  </span>
                  <span className="font-semibold capitalize text-gray-900">
                    {event.event_type.replace(/_/g, " ")}
                  </span>
                  {typeof event.metadata?.reason === "string" && event.metadata.reason && (
                    <span className="text-gray-500">— {event.metadata.reason}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold text-gray-900 ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}
