"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReorderResult =
  | { ok: true; added: number; skipped: string[] }
  | { ok: false; error: string };

type PastItem = {
  menu_item_id: string | null;
  quantity: number;
  item_name: string;
  menu_items: { id: string; name: string; is_available: boolean } | null;
};

/**
 * Puts everything from a past order back in the cart.
 *
 * Deliberately skips anything that's been deleted or is unavailable today
 * rather than failing the whole thing — and says exactly what it skipped, so
 * the customer isn't surprised at checkout.
 */
export async function reorder(orderId: string): Promise<ReorderResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in first." };

  // RLS already scopes this to their own orders; the filter makes it explicit.
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_items(menu_item_id, quantity, item_name, menu_items(id, name, is_available))")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (!order) return { ok: false, error: "Order not found." };

  const items = ((order as unknown as { order_items: PastItem[] }).order_items ?? []);
  if (items.length === 0) return { ok: false, error: "That order has no items." };

  const skipped: string[] = [];
  const wanted: { id: string; quantity: number }[] = [];

  for (const it of items) {
    if (!it.menu_items || !it.menu_item_id) {
      skipped.push(it.item_name); // dish removed from the menu since
      continue;
    }
    if (!it.menu_items.is_available) {
      skipped.push(it.menu_items.name); // sold out today
      continue;
    }
    wanted.push({ id: it.menu_item_id, quantity: it.quantity });
  }

  if (wanted.length === 0) {
    return { ok: false, error: "None of those dishes are available right now." };
  }

  // Merge with whatever is already in the cart rather than clobbering it.
  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, menu_item_id, quantity")
    .eq("user_id", user.id);

  const current = new Map((existing ?? []).map((r) => [r.menu_item_id, r]));

  for (const w of wanted) {
    const have = current.get(w.id);
    if (have) {
      await supabase
        .from("cart_items")
        .update({ quantity: have.quantity + w.quantity })
        .eq("id", have.id);
    } else {
      await supabase
        .from("cart_items")
        .insert({ user_id: user.id, menu_item_id: w.id, quantity: w.quantity });
    }
  }

  revalidatePath("/cart");
  revalidatePath("/orders");
  return { ok: true, added: wanted.length, skipped };
}
