"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function ManualCodeEntry({ initialValue = "" }: { initialValue?: string }) {
  const [code, setCode] = useState(initialValue === "check" ? "" : initialValue);
  const router = useRouter();

  return (
    <form
      className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (trimmed) router.push(`/verify/${encodeURIComponent(trimmed)}`);
      }}
    >
      <label htmlFor="manual-code" className="block text-sm font-semibold text-gray-900">
        Enter a Pass ID
      </label>
      <input
        id="manual-code"
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="RP-XXXX-XXXX"
        autoCapitalize="characters"
        autoComplete="off"
        className="block w-full rounded-lg border-0 px-3 py-3 text-center font-mono text-lg tracking-widest text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-300 focus:ring-2 focus:ring-inset focus:ring-brand-600"
      />
      <Button type="submit" size="lg" className="w-full">
        Check Status
      </Button>
    </form>
  );
}
