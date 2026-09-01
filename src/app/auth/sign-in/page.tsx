import { AuthForm } from "@/components/resident/AuthForm";
import { createAdminSupabase } from "@/lib/db/client";
import type { Community } from "@/lib/db/types";

export const metadata = { title: "Sign In" };

type SignInPageProps = {
  searchParams: Promise<{ auth_error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { auth_error: authError } = await searchParams;
  const initialError = authError
    ? authError === "recovery"
      ? "That password reset link is invalid or has expired. Request a new one."
      : authError === "profile"
      ? "You are signed in, but we could not finish setting up your account. Please try again."
      : "Google sign-in could not be completed. Please try again."
    : undefined;
  const admin = createAdminSupabase();
  const { data: communities } = await admin
    .from("communities")
    .select("id, name")
    .eq("status", "active")
    .order("name");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            RP
          </span>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            {process.env.NEXT_PUBLIC_APP_NAME ?? "ResidentPass"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your guest parking passes
          </p>
        </div>
        <AuthForm
          initialError={initialError}
          communities={(communities ?? []) as Array<Pick<Community, "id" | "name">>}
        />
        <p className="text-center text-xs text-gray-400">
          Account requests are reviewed by your community before access is granted.
        </p>
      </div>
    </div>
  );
}
