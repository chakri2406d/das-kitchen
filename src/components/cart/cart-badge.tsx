"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Cart icon with a live item count.
 *
 * The count moves the instant you tap (optimistically), then reconciles with the
 * database — but NOT immediately. Re-reading straight away used to race the save
 * that was still in flight: the database still said 0, so the badge reset itself
 * and the number appeared to "flash and vanish". The refresh is debounced so it
 * only runs once things have actually settled.
 */
export function CartBadge() {
  const supabase = createClient();
  const [count, setCount] = useState(0);
  const [bumped, setBumped] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setCount(0);
      return;
    }
    const { data, error } = await supabase.from("cart_items").select("quantity").eq("user_id", user.id);
    // On error keep the optimistic number — better than wrongly showing zero.
    if (error) return;
    setCount((data ?? []).reduce((sum, r) => sum + (r.quantity ?? 0), 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleRefresh = useCallback(
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
        // Optimistic move — instant.
        setCount((c) => Math.max(0, c + delta));
        setBumped(true);
        setTimeout(() => setBumped(false), 400);
        scheduleRefresh(1500); // check later, once the save has landed
      } else {
        // detail 0 = "the write finished" — safe to reconcile shortly.
        scheduleRefresh(300);
      }
    };

    window.addEventListener("cart-updated", onUpdate);
    return () => {
      window.removeEventListener("cart-updated", onUpdate);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh, scheduleRefresh]);

  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-brown transition-colors hover:bg-brown/5 hover:text-gold"
    >
      <ShoppingBag size={19} />
      {count > 0 && (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-white transition-transform",
            bumped && "scale-125"
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
