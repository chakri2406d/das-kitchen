"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/utils";

export type CartRow = {
  id: string;
  quantity: number;
  name: string;
  price: number;
  food_type: string;
};

/** One line in the cart: name, qty +/- controls, line total, remove. */
export function CartItemRow({ row }: { row: CartRow }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function setQuantity(next: number) {
    setBusy(true);
    if (next <= 0) {
      await supabase.from("cart_items").delete().eq("id", row.id);
    } else {
      await supabase.from("cart_items").update({ quantity: next }).eq("id", row.id);
    }
    router.refresh();
    window.dispatchEvent(new CustomEvent("cart-updated", { detail: 0 }));
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brown/10 bg-soft p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          className={`h-3 w-3 shrink-0 rounded-full border-2 ${
            row.food_type === "veg" ? "border-green-600 bg-green-500" : "border-red-600 bg-red-500"
          }`}
        />
        <div>
          <p className="font-display text-lg text-coffee">{row.name}</p>
          <p className="text-sm text-brown/60">{formatINR(row.price)} each</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setQuantity(row.quantity - 1)}
            disabled={busy}
            className="h-8 w-8 rounded-full border border-brown/20 text-coffee hover:bg-brown/5 disabled:opacity-50"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-6 text-center font-medium text-coffee">{row.quantity}</span>
          <button
            onClick={() => setQuantity(row.quantity + 1)}
            disabled={busy}
            className="h-8 w-8 rounded-full border border-brown/20 text-coffee hover:bg-brown/5 disabled:opacity-50"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <span className="w-20 text-right font-semibold text-coffee">
          {formatINR(row.price * row.quantity)}
        </span>
        <button
          onClick={() => setQuantity(0)}
          disabled={busy}
          className="text-sm text-red-600 hover:underline disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
