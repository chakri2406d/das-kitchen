"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { RiderStatus } from "@/types/database";
import { setRiderStatus } from "./actions";

const OPTIONS: { value: RiderStatus; label: string; active: string }[] = [
  { value: "available", label: "Available", active: "bg-green-600 text-white" },
  { value: "busy", label: "Busy", active: "bg-amber-500 text-white" },
  { value: "offline", label: "Offline", active: "bg-brown text-cream" },
];

export function RiderStatusToggle({ current }: { current: RiderStatus }) {
  const [status, setStatus] = useState<RiderStatus>(current);
  const [pending, startTransition] = useTransition();

  function change(next: RiderStatus) {
    const prev = status;
    setStatus(next);
    startTransition(async () => {
      const res = await setRiderStatus(next);
      if (!res.ok) setStatus(prev);
    });
  }

  return (
    <div className="flex gap-1 rounded-full bg-cream p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => change(o.value)}
          disabled={pending}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60",
            status === o.value ? o.active : "text-brown hover:bg-brown/5"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
