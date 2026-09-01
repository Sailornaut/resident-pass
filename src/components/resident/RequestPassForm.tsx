"use client";

import { useActionState, useEffect, useState } from "react";
import { createPassAction, type ActionState } from "@/server/actions/pass-actions";
import { FormField, FormError, inputClasses } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { PLATE_STATES } from "@/lib/validation";
import { getPassDateConstraints } from "@/lib/parking-rules/form-support";
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
  const [values, setValues] = useState(() => ({
    unit_id: state.values?.unit_id ?? units[0]?.id ?? "",
    plate: state.values?.plate ?? "",
    plate_state: state.values?.plate_state ?? PLATE_STATES[0],
    valid_from: state.values?.valid_from ?? "",
    valid_until: state.values?.valid_until ?? "",
    guest_name: state.values?.guest_name ?? "",
    note: state.values?.note ?? "",
  }));

  useEffect(() => {
    if (!state.values) return;
    setValues({
      unit_id: state.values.unit_id ?? units[0]?.id ?? "",
      plate: state.values.plate ?? "",
      plate_state: state.values.plate_state ?? PLATE_STATES[0],
      valid_from: state.values.valid_from ?? "",
      valid_until: state.values.valid_until ?? "",
      guest_name: state.values.guest_name ?? "",
      note: state.values.note ?? "",
    });
  }, [state.values, units]);
  const constraints = rules
    ? getPassDateConstraints(
        values.valid_from,
        rules.max_duration_hours,
        rules.advance_window_days
      )
    : null;

  function updateValue(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateStart(value: string) {
    if (!rules) {
      updateValue("valid_from", value);
      return;
    }

    const nextConstraints = getPassDateConstraints(
      value,
      rules.max_duration_hours,
      rules.advance_window_days
    );
    const endIsOutsideRange =
      values.valid_until &&
      ((!nextConstraints.endMin || values.valid_until < nextConstraints.endMin) ||
        (!nextConstraints.endMax || values.valid_until > nextConstraints.endMax));

    setValues((current) => ({
      ...current,
      valid_from: value,
      valid_until: endIsOutsideRange ? "" : current.valid_until,
    }));
  }

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.errors?._form} />

      {units.length > 1 ? (
        <FormField label="Unit" htmlFor="unit_id" error={state.errors?.unit_id} required>
          <select
            id="unit_id"
            name="unit_id"
            className={inputClasses}
            value={values.unit_id}
            onChange={(event) => updateValue("unit_id", event.target.value)}
            required
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                Unit {u.unit_label}
              </option>
            ))}
          </select>
        </FormField>
      ) : (
        <input type="hidden" name="unit_id" value={values.unit_id} />
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
              value={values.plate}
              onChange={(event) => updateValue("plate", event.target.value)}
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
          <select
            id="plate_state"
            name="plate_state"
            className={inputClasses}
            value={values.plate_state}
            onChange={(event) => updateValue("plate_state", event.target.value)}
            required
          >
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
            step={1800}
            max={constraints?.startMax}
            value={values.valid_from}
            onChange={(event) => updateStart(event.target.value)}
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
            step={1800}
            min={constraints?.endMin}
            max={constraints?.endMax}
            value={values.valid_until}
            onChange={(event) => updateValue("valid_until", event.target.value)}
            disabled={!values.valid_from}
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
            value={values.guest_name}
            onChange={(event) => updateValue("guest_name", event.target.value)}
            className={inputClasses}
          />
        </FormField>
        <FormField label="Note" htmlFor="note" error={state.errors?.note} hint="Optional">
          <input
            id="note"
            name="note"
            type="text"
            maxLength={200}
            value={values.note}
            onChange={(event) => updateValue("note", event.target.value)}
            className={inputClasses}
          />
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
