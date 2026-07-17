"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatINR, cn } from "@/lib/utils";
import type { MenuGroup, Variant } from "@/lib/menu";

// Default the selector to "Full" so customers see the larger option first.
// If there's no explicit "Full", fall back to the highest-priced variant.
function defaultIndex(variants: Variant[]): number {
  const full = variants.findIndex((v) => v.size?.toLowerCase() === "full");
  if (full !== -1) return full;
  let hi = 0;
  variants.forEach((v, i) => {
    if (v.price > variants[hi].price) hi = i;
  });
  return hi;
}

export function MenuCard({
  group,
  userId,
  cartQty = {},
  index = 0,
}: {
  group: MenuGroup;
  userId: string | null;
  /** menu_item_id -> quantity already in this customer's cart */
  cartQty?: Record<string, number>;
  index?: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [sel, setSel] = useState(() => defaultIndex(group.variants));

  // Seeded from the server so the stepper is correct on first paint and after
  // a refresh — the card always tells the truth about what's in the cart.
  const [qtyMap, setQtyMap] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    group.variants.forEach((v) => {
      if (cartQty[v.id]) m[v.id] = cartQty[v.id];
    });
    return m;
  });
  const [failed, setFailed] = useState(false);

  const variant = group.variants[sel];
  const multi = group.variants.length > 1;
  const isVeg = group.food_type === "veg";
  const qty = qtyMap[variant.id] ?? 0;

  function changeQty(next: number) {
    if (!userId) {
      router.push("/login?next=/menu");
      return;
    }
    const target = Math.max(0, next);
    const prev = qty;
    if (target === prev) return;

    // Update the screen instantly; the save happens behind it.
    setQtyMap((m) => ({ ...m, [variant.id]: target }));
    setFailed(false);
    window.dispatchEvent(new CustomEvent("cart-updated", { detail: target - prev }));

    void (async () => {
      // One round-trip: cart_items is unique on (user_id, menu_item_id).
      const { error } =
        target === 0
          ? await supabase
              .from("cart_items")
              .delete()
              .eq("user_id", userId)
              .eq("menu_item_id", variant.id)
          : await supabase
              .from("cart_items")
              .upsert(
                { user_id: userId, menu_item_id: variant.id, quantity: target },
                { onConflict: "user_id,menu_item_id" }
              );

      if (error) {
        // Put it back rather than lie about what's in the cart.
        setQtyMap((m) => ({ ...m, [variant.id]: prev }));
        setFailed(true);
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: prev - target }));
        return;
      }
      // Tell the badge to reconcile now that the write has actually landed.
      window.dispatchEvent(new CustomEvent("cart-updated", { detail: 0 }));
    })();
  }

  return (
    <article
      className="animate-fade-up rounded-2xl border border-brown/10 bg-soft p-5 shadow-card transition-shadow hover:shadow-warm"
      style={{ animationDelay: `${Math.min(index * 45, 320)}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-3 w-3 shrink-0 rounded-full border-2",
                isVeg
                  ? "border-green-600 bg-green-500"
                  : group.food_type === "egg"
                    ? "border-amber-600 bg-amber-500"
                    : "border-red-600 bg-red-500"
              )}
              title={group.food_type}
            />
            <h3 className="font-display text-lg text-coffee">{group.base}</h3>
            {group.is_special && (
              <span className="rounded-full bg-gold-soft/70 px-2 py-0.5 text-[11px] font-semibold text-coffee">
                Special
              </span>
            )}
          </div>
          {group.description && <p className="mt-1 text-sm text-brown/70">{group.description}</p>}
          {multi && (
            <p className="mt-1.5 text-xs text-brown/55">
              {group.variants.map((v) => `${v.size ?? "Regular"} ${formatINR(v.price)}`).join("  ·  ")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {multi && (
          <select
            value={sel}
            onChange={(e) => setSel(Number(e.target.value))}
            aria-label={`Choose size for ${group.base}`}
            className="rounded-full border border-brown/20 bg-white px-3 py-1.5 text-sm text-brown outline-none focus:border-gold"
          >
            {group.variants.map((v, i) => {
              const q = qtyMap[v.id] ?? 0;
              return (
                <option key={v.id} value={i}>
                  {v.size ?? "Regular"} · {formatINR(v.price)}
                  {q > 0 ? ` (${q} in cart)` : ""}
                </option>
              );
            })}
          </select>
        )}

        <span className="ml-auto font-semibold text-coffee">{formatINR(variant.price)}</span>

        {qty === 0 ? (
          <button
            onClick={() => changeQty(1)}
            className="rounded-full bg-gold px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gold-dark active:scale-95"
          >
            Add
          </button>
        ) : (
          // Stays put for good — permanent proof it's in the cart.
          <div className="flex items-center gap-1 rounded-full bg-green-600 p-1 text-white">
            <button
              onClick={() => changeQty(qty - 1)}
              aria-label={`Remove one ${group.base}`}
              className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-green-700 active:scale-90"
            >
              <Minus size={14} />
            </button>
            <span className="min-w-[1.25rem] text-center text-sm font-bold tabular-nums">{qty}</span>
            <button
              onClick={() => changeQty(qty + 1)}
              aria-label={`Add another ${group.base}`}
              className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-green-700 active:scale-90"
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      {qty > 0 && (
        <p className="mt-2 text-right text-xs font-medium text-green-700">
          {qty} × {variant.size ?? "Regular"} in cart · {formatINR(qty * variant.price)}
        </p>
      )}
      {failed && <p className="mt-2 text-right text-xs text-red-600">Couldn&apos;t save — try again.</p>}
    </article>
  );
}
