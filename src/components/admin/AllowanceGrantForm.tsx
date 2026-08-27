"use client";

import { useActionState } from "react";
import { grantPassAllowanceAction } from "@/server/actions/admin-actions";
import type { ActionState } from "@/server/actions/pass-actions";
import { Button } from "@/components/ui/Button";
import { FormError, FormSuccess, inputClasses } from "@/components/ui/FormField";

const initialState: ActionState = { ok: false };

export function AllowanceGrantForm({
  communityId,
  userId,
  residentName,
}: {
  communityId: string;
  userId: string;
  residentName: string;
}) {
  const action = grantPassAllowanceAction.bind(null, communityId, userId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-lg bg-gray-50 p-3 ring-1 ring-gray-200">
      <FormError message={!state.ok ? state.message ?? state.errors?._form : undefined} />
      <FormSuccess message={state.ok ? state.message : undefined} />

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-gray-700">
          Extra passes
          <input
            name="additional_passes"
            type="number"
            min={1}
            max={20}
            defaultValue={1}
            aria-label={`Additional passes for ${residentName}`}
            className={`${inputClasses} mt-1`}
            required
          />
          {state.errors?.additional_passes && (
            <span className="mt-1 block text-red-600">{state.errors.additional_passes}</span>
          )}
        </label>
        <label className="text-xs font-medium text-gray-700">
          Valid for days
          <input
            name="valid_days"
            type="number"
            min={1}
            max={90}
            defaultValue={30}
            aria-label={`Valid days for ${residentName}`}
            className={`${inputClasses} mt-1`}
            required
          />
          {state.errors?.valid_days && (
            <span className="mt-1 block text-red-600">{state.errors.valid_days}</span>
          )}
        </label>
      </div>

      <label className="block text-xs font-medium text-gray-700">
        Approval reason
        <input
          name="reason"
          type="text"
          maxLength={300}
          placeholder="e.g. Family emergency"
          aria-label={`Approval reason for ${residentName}`}
          className={`${inputClasses} mt-1`}
          required
        />
        {state.errors?.reason && (
          <span className="mt-1 block text-red-600">{state.errors.reason}</span>
        )}
      </label>

      <Button
        type="submit"
        size="sm"
        disabled={pending}
        aria-label={`Approve allowance for ${residentName}`}
      >
        {pending ? "Approving…" : "Approve allowance"}
      </Button>
    </form>
  );
}
