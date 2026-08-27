"use client";

import { useActionState } from "react";
import { updateRulesAction } from "@/server/actions/admin-actions";
import type { ActionState } from "@/server/actions/pass-actions";
import { Button } from "@/components/ui/Button";
import { FormField, FormError, FormSuccess, inputClasses } from "@/components/ui/FormField";
import type { ParkingRuleSet } from "@/lib/db/types";

const initialState: ActionState = { ok: false };

export function RulesForm({
  communityId,
  rules,
}: {
  communityId: string;
  rules: ParkingRuleSet;
}) {
  const action = updateRulesAction.bind(null, communityId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={!state.ok ? state.message : undefined} />
      <FormSuccess message={state.ok ? state.message : undefined} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          label="Max simultaneous active passes per unit"
          htmlFor="max_active_passes"
          error={state.errors?.max_active_passes}
          required
        >
          <input
            id="max_active_passes"
            name="max_active_passes"
            type="number"
            min={1}
            max={20}
            defaultValue={rules.max_active_passes}
            className={inputClasses}
            required
          />
        </FormField>
        <FormField
          label="Maximum pass duration (hours)"
          htmlFor="max_duration_hours"
          error={state.errors?.max_duration_hours}
          required
        >
          <input
            id="max_duration_hours"
            name="max_duration_hours"
            type="number"
            min={1}
            max={720}
            defaultValue={rules.max_duration_hours}
            className={inputClasses}
            required
          />
        </FormField>
        <FormField
          label="Passes per unit per rolling 30 days"
          htmlFor="monthly_limit"
          error={state.errors?.monthly_limit}
          required
        >
          <input
            id="monthly_limit"
            name="monthly_limit"
            type="number"
            min={1}
            max={100}
            defaultValue={rules.monthly_limit}
            className={inputClasses}
            required
          />
        </FormField>
        <FormField
          label="Advance request window (days)"
          htmlFor="advance_window_days"
          error={state.errors?.advance_window_days}
          hint="How far in advance a resident may schedule a pass"
          required
        >
          <input
            id="advance_window_days"
            name="advance_window_days"
            type="number"
            min={0}
            max={90}
            defaultValue={rules.advance_window_days}
            className={inputClasses}
            required
          />
        </FormField>
      </div>

      <label className="flex items-center gap-2.5 text-sm text-gray-900">
        <input
          type="checkbox"
          name="allow_resident_cancel"
          defaultChecked={rules.allow_resident_cancel}
          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-600"
        />
        Allow residents to cancel their own passes
      </label>

      <div className="border-t border-gray-100 pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save rules"}
        </Button>
        <p className="mt-2 text-xs text-gray-500">
          Changes apply to new requests only. Existing passes are unaffected unless revoked.
        </p>
      </div>
    </form>
  );
}
