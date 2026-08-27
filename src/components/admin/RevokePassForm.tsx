"use client";

import { useActionState, useState } from "react";
import { revokePassAction } from "@/server/actions/admin-actions";
import type { ActionState } from "@/server/actions/pass-actions";
import { Button } from "@/components/ui/Button";
import { FormError, FormSuccess, inputClasses } from "@/components/ui/FormField";

const initialState: ActionState = { ok: false };

export function RevokePassForm({ passId }: { passId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(revokePassAction, initialState);

  if (state.ok) {
    return <FormSuccess message={state.message} />;
  }

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        Revoke this pass
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg bg-red-50 p-4 ring-1 ring-red-200">
      <input type="hidden" name="pass_id" value={passId} />
      <FormError message={state.message ?? state.errors?._form} />
      <p className="text-sm font-semibold text-red-900">
        Revoking immediately invalidates this pass. Verification will show REVOKED.
      </p>
      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-red-900">
          Reason (optional, recorded in the audit log)
        </label>
        <input
          id="reason"
          name="reason"
          type="text"
          maxLength={300}
          className={`${inputClasses} mt-1.5`}
          placeholder="e.g. Vehicle parked in a fire lane"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Revoking…" : "Confirm revoke"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
