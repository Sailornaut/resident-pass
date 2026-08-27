"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/Button";
import { FormError, FormSuccess, inputClasses } from "@/components/ui/FormField";

/**
 * Passwordless (magic link) sign-in. Supabase emails a one-time link;
 * the /auth/callback route exchanges it for a session.
 */
export function SignInForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setPending(false);
    if (authError) {
      setError("Could not send the sign-in link. Check the address and try again.");
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <FormSuccess
        message={`Check your email — we sent a sign-in link to ${email}.`}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <FormError message={error ?? undefined} />
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-900">
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className={`${inputClasses} mt-1.5`}
          required
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending link…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
