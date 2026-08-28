import { AuthForm } from "@/components/resident/AuthForm";

export const metadata = { title: "Sign In" };

type SignInPageProps = {
  searchParams: Promise<{ auth_error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { auth_error: authError } = await searchParams;
  const initialError = authError
    ? authError === "profile"
      ? "You are signed in, but we could not finish setting up your account. Please try again."
      : "Google sign-in could not be completed. Please try again."
    : undefined;

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
        <AuthForm initialError={initialError} />
        <p className="text-center text-xs text-gray-400">
          Create your account, then contact your property manager to be assigned
          to your community and unit.
        </p>
      </div>
    </div>
  );
}
