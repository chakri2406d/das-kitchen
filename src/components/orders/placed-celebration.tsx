"use client";

import { useState } from "react";
import { Confetti } from "@/components/ui/confetti";

/** Celebrates a freshly placed order — confetti + a warm confirmation. */
export function PlacedCelebration({ orderNumber }: { orderNumber: string }) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <Confetti />
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-coffee/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-scale-in rounded-2xl bg-soft p-8 text-center shadow-warm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-soft/70 text-3xl">
              🎉
            </div>
            <h2 className="mt-4 font-display text-2xl text-coffee">Order placed!</h2>
            <p className="mt-1 text-sm font-semibold text-gold-dark">{orderNumber}</p>
            <p className="mt-2 text-sm text-brown/75">
              Our kitchen is firing up. You can watch your order and your rider live on this page.
            </p>
            <button
              onClick={() => setOpen(false)}
              className="mt-6 w-full rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-white hover:bg-gold-dark"
            >
              Track my order
            </button>
          </div>
        </div>
      )}
    </>
  );
}
