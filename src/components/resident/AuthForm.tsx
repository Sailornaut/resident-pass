"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/Button";
import { FormError, FormSuccess, inputClasses } from "@/components/ui/FormField";

type AuthMode = "sign-in" | "sign-up";

type AuthErrorLike = {
  code?: string;
  status?: number;
};

export function authErrorMessage(
  authError: AuthErrorLike,
  mode: AuthMode
): string {
  if (authError.status === 429 || authError.code === "over_request_rate_limit") {
    return "Too many attempts. Please wait a few minutes and try again.";
  }

  if (authError.code === "email_address_invalid") {
    return "Enter a valid email address.";
  }

  if (authError.code === "invalid_credentials") {
    return "The email or password is incorrect.";
  }

  if (
    authError.code === "user_already_exists" ||
    authError.code === "identity_already_exists"
  ) {
    return "An account already exists for this email. Sign in instead.";
  }

  if (authError.code === "weak_password") {
    return "Choose a stronger password with at least 8 characters.";
  }

  if (authError.code === "signup_disabled") {
    return "Account creation is currently unavailable.";
  }

  return mode === "sign-in"
    ? "Could not sign in. Please try again."
    : "Could not create your account. Please try again.";
}

function validationMessage(
  email: string,
  password: string,
  passwordConfirmation: string,
  mode: AuthMode
): string | null {
  if (!/^\S+@\S+\.\S+$/.test(email)) return "Enter a valid email address.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (mode === "sign-up" && password !== passwordConfirmation) {
    return "Passwords do not match.";
  }
  return null;
}

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setSuccess(null);
    setPassword("");
    setPasswordConfirmation("");
  }

  async function completeProfile(): Promise<boolean> {
    const response = await fetch("/auth/complete-profile", { method: "POST" });
    if (response.ok) return true;

    setError("You are signed in, but we could not finish setting up your account. Please try again.");
    return false;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedEmail = email.trim().toLowerCase();
    const validationError = validationMessage(
      normalizedEmail,
      password,
      passwordConfirmation,
      mode
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    setPending(true);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    if (mode === "sign-in") {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        setError(authErrorMessage(authError, mode));
        setPending(false);
        return;
      }

      if (await completeProfile()) window.location.assign("/");
      setPending(false);
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (authError) {
      setError(authErrorMessage(authError, mode));
      setPending(false);
      return;
    }

    if (!data.session) {
      if (data.user?.identities?.length === 0) {
        setError("An account already exists for this email. Sign in instead.");
        setPending(false);
        return;
      }

      setSuccess(
        "Account created. Email confirmation is required before you can sign in."
      );
      setPending(false);
      return;
    }

    if (await completeProfile()) window.location.assign("/");
    setPending(false);
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <div className="mb-5 grid grid-cols-2 rounded-lg bg-gray-100 p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "sign-in"}
          onClick={() => switchMode("sign-in")}
          className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
            mode === "sign-in" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "sign-up"}
          onClick={() => switchMode("sign-up")}
          className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
            mode === "sign-up" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error ?? undefined} />
        <FormSuccess message={success ?? undefined} />

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-900">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className={`${inputClasses} mt-1.5`}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-900">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            minLength={8}
            className={`${inputClasses} mt-1.5`}
            required
          />
          {mode === "sign-up" && (
            <p className="mt-1 text-xs text-gray-500">Use at least 8 characters.</p>
          )}
        </div>

        {mode === "sign-up" && (
          <div>
            <label
              htmlFor="password_confirmation"
              className="block text-sm font-medium text-gray-900"
            >
              Confirm password
            </label>
            <input
              id="password_confirmation"
              type="password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              className={`${inputClasses} mt-1.5`}
              required
            />
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending
            ? mode === "sign-in" ? "Signing in…" : "Creating account…"
            : mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>

        <p className="text-center text-xs text-gray-400">
          Forgot password? <span className="font-medium">Coming soon</span>
        </p>
      </form>
    </div>
  );
}
