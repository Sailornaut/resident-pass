"use client";

import { useActionState } from "react";
import { createPassAction, type ActionState } from "@/server/actions/pass-actions";
import { FormField, FormError, inputClasses } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { PLATE_STATES } from "@/lib/validation";
import type { ParkingRuleSet, Unit } from "@/lib/db/types";

const initialState: ActionState = { ok: false };

export function RequestPassForm({
  units,
  rules,
}: {
  units: Unit[];
  rules: ParkingRuleSet | null;
}) {
  const [state, formAction, pending] = useActionState(createPassAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.errors?._form} />

      {units.length > 1 ? (
        <FormField label="Unit" htmlFor="unit_id" error={state.errors?.unit_id} required>
          <select id="unit_id" name="unit_id" className={inputClasses} required>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                Unit {u.unit_label}
              </option>
            ))}
          </select>
        </FormField>
      ) : (
        <input type="hidden" name="unit_id" value={units[0]?.id ?? ""} />
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <FormField
            label="Guest license plate"
            htmlFor="plate"
            error={state.errors?.plate}
            hint="Letters and numbers as shown on the plate"
            required
          >
            <input
              id="plate"
              name="plate"
              type="text"
              maxLength={10}
              placeholder="ABC1234"
              autoCapitalize="characters"
              className={`${inputClasses} font-mono uppercase tracking-wider`}
              required
            />
          </FormField>
        </div>
        <FormField
          label="State"
          htmlFor="plate_state"
          error={state.errors?.plate_state}
          required
        >
          <select id="plate_state" name="plate_state" className={inputClasses} required>
            {PLATE_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          label="Valid from"
          htmlFor="valid_from"
          error={state.errors?.valid_from}
          required
        >
          <input
            id="valid_from"
            name="valid_from"
            type="datetime-local"
            className={inputClasses}
            required
          />
        </FormField>
        <FormField
          label="Valid until"
          htmlFor="valid_until"
          error={state.errors?.valid_until}
          hint={
            rules
              ? `Maximum duration: ${rules.max_duration_hours} hours`
              : undefined
          }
          required
        >
          <input
            id="valid_until"
            name="valid_until"
            type="datetime-local"
            className={inputClasses}
            required
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          label="Guest name"
          htmlFor="guest_name"
          error={state.errors?.guest_name}
          hint="Optional — shown only to you and your community admin"
        >
          <input
            id="guest_name"
            name="guest_name"
            type="text"
            maxLength={80}
            className={inputClasses}
          />
        </FormField>
        <FormField label="Note" htmlFor="note" error={state.errors?.note} hint="Optional">
          <input id="note" name="note" type="text" maxLength={200} className={inputClasses} />
        </FormField>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-5">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Checking rules…" : "Request Pass"}
        </Button>
      </div>
    </form>
  );
}
