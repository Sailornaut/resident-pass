"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/Button";
import { FormError, inputClasses } from "@/components/ui/FormField";

export function SetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  useEffect(() => {
    async function establishInvitationSession() {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          setError("This invitation is invalid or has expired. Ask your community administrator for a new one.");
          return;
        }

        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        setSessionReady(true);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
      } else {
        setError("This invitation is invalid or has expired. Ask your community administrator for a new one.");
      }
    }

    void establishInvitationSession();
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    const { error: passwordError } = await supabase.auth.updateUser({ password });

    if (passwordError) {
      setError(
        passwordError.code === "weak_password"
          ? "Choose a stronger password with at least 8 characters."
          : "Could not set your password. The invitation may have expired."
      );
      setPending(false);
      return;
    }

    const profileResponse = await fetch("/auth/complete-profile", {
      method: "POST",
    });
    if (!profileResponse.ok) {
      setError("Your password was saved, but account setup could not be completed.");
      setPending(false);
      return;
    }

    window.location.assign("/");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
    >
      <FormError message={error ?? undefined} />

      <div>
        <label htmlFor="new_password" className="block text-sm font-medium text-gray-900">
          Password
        </label>
        <input
          id="new_password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          className={`${inputClasses} mt-1.5`}
          required
        />
        <p className="mt-1 text-xs text-gray-500">Use at least 8 characters.</p>
      </div>

      <div>
        <label
          htmlFor="new_password_confirmation"
          className="block text-sm font-medium text-gray-900"
        >
          Confirm password
        </label>
        <input
          id="new_password_confirmation"
          type="password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          className={`${inputClasses} mt-1.5`}
          required
        />
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending || !sessionReady}
      >
        {!sessionReady
          ? "Validating invitation…"
          : pending
            ? "Saving password…"
            : "Set password and continue"}
      </Button>
    </form>
  );
}
