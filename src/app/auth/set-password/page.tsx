import { SetPasswordForm } from "@/components/resident/SetPasswordForm";

export const metadata = { title: "Set Password" };

export default function SetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            RP
          </span>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Set your password</h1>
          <p className="mt-1 text-sm text-gray-500">
            Finish setting up your ResidentPass account.
          </p>
        </div>
        <SetPasswordForm />
      </div>
    </div>
  );
}
