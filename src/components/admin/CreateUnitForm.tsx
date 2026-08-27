"use client";

import { useActionState } from "react";
import { createUnitAction } from "@/server/actions/admin-actions";
import type { ActionState } from "@/server/actions/pass-actions";
import { Button } from "@/components/ui/Button";
import { FormField, FormError, FormSuccess, inputClasses } from "@/components/ui/FormField";

const initialState: ActionState = { ok: false };

export function CreateUnitForm({ communityId }: { communityId: string }) {
  const action = createUnitAction.bind(null, communityId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.message && !state.ok ? state.message : state.errors?._form} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Unit label"
          htmlFor="unit_label"
          error={state.errors?.unit_label}
          required
        >
          <input
            id="unit_label"
            name="unit_label"
            type="text"
            maxLength={30}
            placeholder="e.g. 204"
            className={inputClasses}
            required
          />
        </FormField>
        <FormField
          label="Address label"
          htmlFor="address_label"
          error={state.errors?.address_label}
          hint="Optional"
        >
          <input
            id="address_label"
            name="address_label"
            type="text"
            maxLength={120}
            placeholder="e.g. 100 Oak Ridge Dr, Unit 204"
            className={inputClasses}
          />
        </FormField>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Add unit"}
      </Button>
    </form>
  );
}
