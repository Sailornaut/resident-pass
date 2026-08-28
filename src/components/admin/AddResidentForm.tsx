"use client";

import { useActionState } from "react";
import { addResidentAction } from "@/server/actions/admin-actions";
import type { ActionState } from "@/server/actions/pass-actions";
import type { Unit } from "@/lib/db/types";
import { Button } from "@/components/ui/Button";
import { FormError, FormField, FormSuccess, inputClasses } from "@/components/ui/FormField";

const initialState: ActionState = { ok: false };

export function AddResidentForm({
  communityId,
  units,
}: {
  communityId: string;
  units: Unit[];
}) {
  const action = addResidentAction.bind(null, communityId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={!state.ok ? state.message ?? state.errors?._form : undefined} />
      <FormSuccess message={state.ok ? state.message : undefined} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FormField
          label="Resident email"
          htmlFor="resident_email"
          error={state.errors?.email}
          required
        >
          <input
            id="resident_email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="resident@example.com"
            className={inputClasses}
            required
          />
        </FormField>

        <FormField
          label="Resident name"
          htmlFor="resident_full_name"
          error={state.errors?.full_name}
          hint="Optional"
        >
          <input
            id="resident_full_name"
            name="full_name"
            type="text"
            maxLength={80}
            autoComplete="name"
            placeholder="Full name"
            className={inputClasses}
          />
        </FormField>

        <FormField
          label="Unit"
          htmlFor="resident_unit_id"
          error={state.errors?.unit_id}
          required
        >
          <select
            id="resident_unit_id"
            name="unit_id"
            className={inputClasses}
            defaultValue=""
            required
            disabled={units.length === 0}
          >
            <option value="" disabled>
              {units.length === 0 ? "Add a unit first" : "Select a unit"}
            </option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unit_label}{unit.address_label ? ` — ${unit.address_label}` : ""}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <Button type="submit" disabled={pending || units.length === 0}>
        {pending ? "Assigning resident…" : "Assign or invite resident"}
      </Button>
    </form>
  );
}
