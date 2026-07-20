"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/utils";

type CartRow = { quantity: number; menu_items: { price: number } | null };

/**
 * Sticky bottom bar that appears the moment there's something in the cart, so
 * customers always have an obvious "next step" without hunting for the cart icon.
 * Stays in sync via the same "cart-updated" event the cart badge uses.
 */
export function CartBar() {
  const supabase = createClient();
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setCount(0);
      setTotal(0);
      return;
    }
    const { data, error } = await supabase
      .from("cart_items")
      .select("quantity, menu_items(price)")
      .eq("user_id", user.id);
    if (error) return;
    const rows = (data ?? []) as unknown as CartRow[];
    let c = 0;
    let t = 0;
    for (const r of rows) {
      c += r.quantity ?? 0;
      if (r.menu_items) t += Number(r.menu_items.price) * (r.quantity ?? 0);
    }
    setCount(c);
    setTotal(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedule = useCallback(
    (delay: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void refresh(), delay);
    },
    [refresh]
  );

  useEffect(() => {
    void refresh();
    const onUpdate = (e: Event) => {
      const delta = (e as CustomEvent<number>).detail;
      if (typeof delta === "number" && delta !== 0) {
        setCount((c) => Math.max(0, c + delta)); // optimistic, instant
        schedule(1200);
      } else {
        schedule(300);
      }
    };
    window.addEventListener("cart-updated", onUpdate);
    return () => {
      window.removeEventListener("cart-updated", onUpdate);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh, schedule]);

  if (count <= 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
      <Link
        href="/cart"
        className="pointer-events-auto flex w-full max-w-lg animate-fade-up items-center justify-between gap-3 rounded-full bg-coffee px-4 py-3 text-cream shadow-warm transition-transform hover:scale-[1.01]"
      >
        <span className="flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-cream/15">
            <ShoppingBag size={18} />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          </span>
          <span className="text-sm font-semibold">
            {count} item{count === 1 ? "" : "s"} · {formatINR(total)}
          </span>
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold">
          Proceed to cart <ArrowRight size={16} />
        </span>
      </Link>
    </div>
  );
}
