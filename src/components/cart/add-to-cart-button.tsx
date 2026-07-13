"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type State = "idle" | "loading" | "added";

/**
 * Adds a menu item to the signed-in user's cart (cart_items table).
 * If the user isn't logged in, sends them to the login page and back.
 */
export function AddToCartButton({ menuItemId }: { menuItemId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [state, setState] = useState<State>("idle");

  async function add() {
    setState("loading");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login?next=/menu");
      return;
    }

    // Already in cart? bump the quantity. Otherwise insert a new row.
    const { data: existing } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("user_id", user.id)
      .eq("menu_item_id", menuItemId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("cart_items")
        .update({ quantity: existing.quantity + 1 })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("cart_items")
        .insert({ user_id: user.id, menu_item_id: menuItemId, quantity: 1 });
    }

    setState("added");
    router.refresh();
    setTimeout(() => setState("idle"), 1500);
  }

  return (
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
  );
}
