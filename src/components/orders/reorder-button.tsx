"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { reorder } from "@/app/(customer)/orders/actions";

/** One tap to put a past order back in the cart. */
export function ReorderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function go() {
    setNote(null);
    startTransition(async () => {
      const res = await reorder(orderId);
      if (!res.ok) {
        setNote(res.error);
        return;
      }
      if (res.skipped.length > 0) {
        // Tell them before they reach checkout and wonder what happened.
        setNote(`Added. Skipped (unavailable): ${res.skipped.join(", ")}`);
        setTimeout(() => router.push("/cart"), 1800);
        return;
      }
      router.push("/cart");
    });
  }

  return (
    <>
      <button
        onClick={go}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full border border-brown/25 px-4 py-1.5 text-sm font-medium text-brown transition-colors hover:bg-brown/5 disabled:opacity-60"
      >
        <RotateCcw size={14} /> {pending ? "Adding…" : "Order again"}
      </button>
      {note && <p className="mt-2 text-xs text-brown/70">{note}</p>}
    </>
  );
}
