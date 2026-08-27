"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelPassAction } from "@/server/actions/pass-actions";
import { Button } from "@/components/ui/Button";

export function CancelPassButton({ passId }: { passId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        Cancel this pass
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Cancel this pass?</span>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Keep it
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelPassAction(passId);
              if (!result.ok) {
                setError(result.message ?? "Could not cancel the pass.");
              } else {
                router.refresh();
              }
            })
          }
        >
          {pending ? "Cancelling…" : "Yes, cancel"}
        </Button>
      </div>
    </div>
  );
}
