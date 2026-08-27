import { SignInForm } from "@/components/resident/SignInForm";

export const metadata = { title: "Sign In" };

export default function SignInPage() {
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
            Sign in to manage your guest parking passes
          </p>
        </div>
        <SignInForm />
        <p className="text-center text-xs text-gray-400">
          Accounts are created by invitation from your community. If you haven&apos;t
          received one, contact your property manager.
        </p>
      </div>
    </div>
  );
}
