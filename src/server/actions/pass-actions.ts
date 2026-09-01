"use server";

/**
 * Server actions for resident pass workflows.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthorizedContext } from "@/lib/auth";
import { createPassSchema, flattenErrors } from "@/lib/validation";
import { ruleViolationsToFormErrors } from "@/lib/parking-rules/form-support";
import { issuePass, cancelPass } from "@/server/services/pass-service";

export interface ActionState {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  passId?: string;
  values?: Record<string, string>;
}

/**
 * Normalize a datetime-local input value ("2026-08-27T14:00") to a full
 * ISO string with offset. Interpreted in the server's timezone for MVP;
 * pilot hardening converts using the community timezone client-side.
 */
function toIso(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  return isNaN(date.getTime()) ? "" : date.toISOString();
}

export async function createPassAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuthorizedContext();

  const values = {
    unit_id: String(formData.get("unit_id") ?? ""),
    plate: String(formData.get("plate") ?? ""),
    plate_state: String(formData.get("plate_state") ?? ""),
    vehicle_make: String(formData.get("vehicle_make") ?? ""),
    vehicle_color: String(formData.get("vehicle_color") ?? ""),
    guest_name: String(formData.get("guest_name") ?? ""),
    note: String(formData.get("note") ?? ""),
    valid_from: String(formData.get("valid_from") ?? ""),
    valid_until: String(formData.get("valid_until") ?? ""),
  };

  const parsed = createPassSchema.safeParse({
    ...values,
    valid_from: toIso(values.valid_from),
    valid_until: toIso(values.valid_until),
  });

  if (!parsed.success) {
    return { ok: false, errors: flattenErrors(parsed.error), values };
  }

  const result = await issuePass(ctx, parsed.data);

  if (!result.ok) {
    if (result.evaluation) {
      return {
        ok: false,
        errors: ruleViolationsToFormErrors(result.evaluation.violations),
        values,
      };
    }
    return {
      ok: false,
      errors: { _form: result.error ?? "Something went wrong." },
      values,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/passes");
  redirect(`/passes/${result.pass!.id}/confirmation`);
}

export async function cancelPassAction(passId: string): Promise<ActionState> {
  const ctx = await requireAuthorizedContext();
  const result = await cancelPass(ctx, passId);

  if (!result.ok) {
    return { ok: false, message: result.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/passes");
  return { ok: true, message: "Pass cancelled." };
}
