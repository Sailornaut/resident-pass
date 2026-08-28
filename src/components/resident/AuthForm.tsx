"use client";

import { useEffect, useMemo, useState } from "react";
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

type AuthFormProps = {
  initialError?: string;
};

export function AuthForm({ initialError }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState<"password" | "google" | null>(null);
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { detectSessionInUrl: false } }
      ),
    []
  );

  useEffect(() => {
    async function routePendingInvitation() {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const isInvite = fragment.get("type") === "invite";
      const hasInviteSession =
        fragment.has("access_token") && fragment.has("refresh_token");

      if (isInvite && hasInviteSession) {
        window.location.replace(`/auth/set-password${window.location.hash}`);
        return;
      }

      // Supabase may already have consumed the fragment into browser cookies.
      // Check the app membership so that accepted invitations cannot dead-end here.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch("/auth/invitation-status", {
        cache: "no-store",
      });
      if (!response.ok) return;

      const status = (await response.json()) as { pending?: boolean };
      if (status.pending) window.location.replace("/auth/set-password");
    }

    void routePendingInvitation();
  }, [supabase]);

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

    setPending("password");

    if (mode === "sign-in") {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        setError(authErrorMessage(authError, mode));
        setPending(null);
        return;
      }

      if (await completeProfile()) window.location.assign("/");
      setPending(null);
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (authError) {
      setError(authErrorMessage(authError, mode));
      setPending(null);
      return;
    }

    if (!data.session) {
      if (data.user?.identities?.length === 0) {
        setError("An account already exists for this email. Sign in instead.");
        setPending(null);
        return;
      }

      setSuccess(
        "Account created. Email confirmation is required before you can sign in."
      );
      setPending(null);
      return;
    }

    if (await completeProfile()) window.location.assign("/");
    setPending(null);
  }

  async function handleGoogleSignIn() {
    setError(null);
    setSuccess(null);
    setPending("google");

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/oauth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (authError) {
      setError("Could not start Google sign-in. Please try again.");
      setPending(null);
    }
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

      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={handleGoogleSignIn}
        disabled={pending !== null}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
          <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
          <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
          <path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.07 12c0-.67.12-1.32.32-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.64.39 3.19 1.04 4.55l3.35-2.62Z" />
          <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z" />
        </svg>
        {pending === "google" ? "Opening Google…" : "Continue with Google"}
      </Button>

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
          or continue with email
        </span>
        <div className="h-px flex-1 bg-gray-200" />
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

        <Button type="submit" size="lg" className="w-full" disabled={pending !== null}>
          {pending === "password"
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
