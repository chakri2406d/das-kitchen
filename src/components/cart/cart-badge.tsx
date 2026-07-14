"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Cart icon with a live item-count badge. Reads the signed-in user's cart and
 * refreshes whenever a "cart-updated" event fires (dispatched by add-to-cart
 * and the cart quantity controls) — so the count updates without a page reload.
 */
export function CartBadge() {
  const supabase = createClient();
  const [count, setCount] = useState(0);

  async function refresh() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setCount(0);
      return;
    }
    const { data } = await supabase.from("cart_items").select("quantity").eq("user_id", user.id);
    setCount((data ?? []).reduce((sum, r) => sum + (r.quantity ?? 0), 0));
  }

  useEffect(() => {
    refresh();
    const onUpdate = (e: Event) => {
      const delta = (e as CustomEvent<number>).detail;
      if (typeof delta === "number") setCount((c) => Math.max(0, c + delta)); // instant
      refresh(); // reconcile with the real value
    };
    window.addEventListener("cart-updated", onUpdate);
    return () => window.removeEventListener("cart-updated", onUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-brown transition-colors hover:bg-brown/5 hover:text-gold"
    >
      <ShoppingBag size={19} />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
