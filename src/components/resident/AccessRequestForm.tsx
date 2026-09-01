"use client";

import { useActionState } from "react";
import { createAccessRequestAction } from "@/server/actions/access-request-actions";
import type { ActionState } from "@/server/actions/pass-actions";
import { Button } from "@/components/ui/Button";
import { FormError, FormField, FormSuccess, inputClasses } from "@/components/ui/FormField";
import type { Community } from "@/lib/db/types";

const initialState: ActionState = { ok: false };

export function AccessRequestForm({
  communities,
  defaultName = "",
  defaultEmail = "",
}: {
  communities: Array<Pick<Community, "id" | "name">>;
  defaultName?: string;
  defaultEmail?: string;
}) {
  const [state, formAction, pending] = useActionState(
    createAccessRequestAction,
    initialState
  );

  if (state.ok) {
    return <FormSuccess message={state.message} />;
  }

  return (
    <form action={formAction} className="w-full max-w-md space-y-4 text-left">
      <FormError message={state.message ?? state.errors?._form} />

      <FormField
        label="Name"
        htmlFor="request_full_name"
        error={state.errors?.full_name}
        required
      >
        <input
          id="request_full_name"
          name="full_name"
          type="text"
          maxLength={80}
          autoComplete="name"
          defaultValue={defaultName}
          placeholder="Full name"
          className={inputClasses}
          required
        />
      </FormField>

      <FormField
        label="Email"
        htmlFor="request_email"
        error={state.errors?.email}
        required
      >
        <input
          id="request_email"
          name="email"
          type="email"
          maxLength={254}
          autoComplete="email"
          defaultValue={defaultEmail}
          placeholder="you@example.com"
          className={inputClasses}
          required
        />
      </FormField>

      <FormField
        label="Unit address"
        htmlFor="request_unit_label"
        error={state.errors?.requested_unit_label}
        required
      >
        <input
          id="request_unit_label"
          name="requested_unit_label"
          type="text"
          maxLength={120}
          autoComplete="street-address"
          placeholder="Street address and unit number"
          className={inputClasses}
          required
        />
      </FormField>

      <FormField
        label="Community"
        htmlFor="request_community_id"
        error={state.errors?.community_id}
        required
      >
        <select
          id="request_community_id"
          name="community_id"
          defaultValue=""
          className={inputClasses}
          required
          disabled={communities.length === 0}
        >
          <option value="" disabled>
            {communities.length === 0 ? "No communities available" : "Select your community"}
          </option>
          {communities.map((community) => (
            <option key={community.id} value={community.id}>
              {community.name}
            </option>
          ))}
        </select>
      </FormField>

      <div className="absolute -left-[10000px]" aria-hidden="true">
        <label htmlFor="request_website">Website</label>
        <input
          id="request_website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={pending || communities.length === 0}
      >
        {pending ? "Sending request…" : "Request access"}
      </Button>
    </form>
  );
}
