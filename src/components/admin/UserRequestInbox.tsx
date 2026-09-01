"use client";

import { useActionState, useEffect, useState } from "react";
import { addResidentAction } from "@/server/actions/admin-actions";
import type { ActionState } from "@/server/actions/pass-actions";
import type { Unit, UserAccessRequest } from "@/lib/db/types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { FormError, FormField, FormSuccess, inputClasses } from "@/components/ui/FormField";

const initialState: ActionState = { ok: false };

export function UserRequestTable({
  requests,
  units,
  community,
}: {
  requests: UserAccessRequest[];
  units: Unit[];
  community: { id: string; name: string; timezone: string };
}) {
  const [selectedRequest, setSelectedRequest] = useState<UserAccessRequest | null>(null);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    setInteractive(true);
  }, []);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">Resident</th>
              <th className="px-3 py-2">Requested unit</th>
              <th className="px-3 py-2">Message</th>
              <th className="px-3 py-2">Received</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests.map((request) => (
              <tr key={request.id}>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRequest(request)}
                    disabled={!interactive}
                    className="text-left font-semibold text-brand-700 hover:text-brand-800 hover:underline disabled:cursor-wait"
                  >
                    {request.full_name || request.email}
                  </button>
                  {request.full_name && <p className="text-gray-500">{request.email}</p>}
                </td>
                <td className="px-3 py-3 font-medium text-gray-900">
                  {request.requested_unit_label}
                </td>
                <td className="max-w-xs px-3 py-3 text-gray-500">
                  {request.note || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-gray-500">
                  {formatDateTime(request.created_at, community.timezone)}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={
                      request.status === "pending"
                        ? "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
                        : "rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold capitalize text-gray-600"
                    }
                  >
                    {request.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRequest && (
        <RequestDrawer
          key={selectedRequest.id}
          request={selectedRequest}
          units={units}
          community={community}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </>
  );
}

function RequestDrawer({
  request,
  units,
  community,
  onClose,
}: {
  request: UserAccessRequest;
  units: Unit[];
  community: { id: string; name: string; timezone: string };
  onClose: () => void;
}) {
  const action = addResidentAction.bind(null, community.id);
  const [state, formAction, pending] = useActionState(action, initialState);
  const exactUnit = units.find(
    (unit) => unit.address_label === request.requested_unit_label
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-gray-950/35" role="presentation">
      <button
        type="button"
        aria-label="Close request details"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-detail-title"
        className="relative z-10 h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              User request
            </p>
            <h2 id="request-detail-title" className="mt-1 text-xl font-bold text-gray-900">
              {request.full_name || request.email}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Close request details"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <dl className="mt-6 divide-y divide-gray-100 rounded-xl border border-gray-200 px-4">
          <Detail label="Name" value={request.full_name || "—"} />
          <Detail label="Email" value={request.email} />
          <Detail label="Unit address" value={request.requested_unit_label} />
          <Detail label="Community" value={community.name} />
          <Detail
            label="Requested"
            value={formatDateTime(request.created_at, community.timezone)}
          />
          <Detail label="Status" value={request.status} capitalize />
        </dl>

        {request.status === "pending" ? (
          <form action={formAction} className="mt-6 space-y-4 border-t border-gray-200 pt-6">
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="email" value={request.email} />
            <input type="hidden" name="full_name" value={request.full_name ?? ""} />

            <h3 className="text-base font-semibold text-gray-900">Assign to unit</h3>
            <p className="text-sm text-gray-500">
              Assignment is explicit. Opening this request does not grant access.
            </p>

            <FormError message={!state.ok ? state.message ?? state.errors?._form : undefined} />
            <FormSuccess message={state.ok ? state.message : undefined} />

            {!state.ok && (
              <>
                <FormField
                  label="Unit"
                  htmlFor={`request_unit_${request.id}`}
                  error={state.errors?.unit_id}
                  hint={
                    exactUnit
                      ? "Exact address match found and preselected."
                      : "No exact address match was found. Select the correct unit."
                  }
                  required
                >
                  <select
                    id={`request_unit_${request.id}`}
                    name="unit_id"
                    className={inputClasses}
                    defaultValue={exactUnit?.id ?? ""}
                    required
                    disabled={units.length === 0}
                  >
                    <option value="" disabled>
                      {units.length === 0 ? "No units available" : "Select a unit"}
                    </option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unit_label}
                        {unit.address_label ? ` — ${unit.address_label}` : ""}
                      </option>
                    ))}
                  </select>
                </FormField>

                <Button type="submit" disabled={pending || units.length === 0}>
                  {pending ? "Assigning…" : "Assign to Unit"}
                </Button>
              </>
            )}
          </form>
        ) : (
          <p className="mt-6 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
            This request is part of the audit history and is no longer pending.
          </p>
        )}
      </section>
    </div>
  );
}

function Detail({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-4 py-3 text-sm">
      <dt className="font-medium text-gray-500">{label}</dt>
      <dd className={`col-span-2 text-right font-semibold text-gray-900 ${capitalize ? "capitalize" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
