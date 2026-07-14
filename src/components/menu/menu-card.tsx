"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatINR, cn } from "@/lib/utils";
import type { MenuGroup } from "@/lib/menu";

type State = "idle" | "loading" | "added";

export function MenuCard({ group, index = 0 }: { group: MenuGroup; index?: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [sel, setSel] = useState(0);
  const [state, setState] = useState<State>("idle");

  const variant = group.variants[sel];
  const multi = group.variants.length > 1;
  const isVeg = group.food_type === "veg";

  async function add() {
    setState("loading");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login?next=/menu");
      return;
    }
    const { data: existing } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("user_id", user.id)
      .eq("menu_item_id", variant.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("cart_items").update({ quantity: existing.quantity + 1 }).eq("id", existing.id);
    } else {
      await supabase.from("cart_items").insert({ user_id: user.id, menu_item_id: variant.id, quantity: 1 });
    }
    setState("added");
    router.refresh();
    setTimeout(() => setState("idle"), 1500);
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
                isVeg ? "border-green-600 bg-green-500" : group.food_type === "egg" ? "border-amber-600 bg-amber-500" : "border-red-600 bg-red-500"
              )}
              title={group.food_type}
            />
            <h3 className="font-display text-lg text-coffee">{group.base}</h3>
            {group.is_special && (
              <span className="rounded-full bg-gold-soft/70 px-2 py-0.5 text-[11px] font-semibold text-coffee">Special</span>
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
            {group.variants.map((v, i) => (
              <option key={v.id} value={i}>
                {v.size ?? "Regular"} · {formatINR(v.price)}
              </option>
            ))}
          </select>
        )}

        <span className="ml-auto font-semibold text-coffee">{formatINR(variant.price)}</span>

        <button
          onClick={add}
          disabled={state === "loading"}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-60",
            state === "added" ? "bg-green-600" : "bg-gold hover:bg-gold-dark"
          )}
        >
          {state === "added" ? "Added ✓" : state === "loading" ? "Adding…" : "Add"}
        </button>
      </div>
    </article>
  );
}
