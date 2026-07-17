"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

/** Shown instead of a raw crash screen when something unexpected breaks. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the real cause in the browser console for debugging.
    console.error("Das Kitchen error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md rounded-2xl border border-brown/10 bg-soft p-8 text-center shadow-warm">
        <Image src="/logo.png" alt="Das Kitchen" width={72} height={72} className="mx-auto rounded-full" />
        <h1 className="mt-5 font-display text-2xl text-coffee">Something went wrong</h1>
        <p className="mt-2 text-sm text-brown/75">
          Sorry — that didn&apos;t work. Your order and cart are safe. Please try again.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-white hover:bg-gold-dark"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-brown/25 px-6 py-2.5 text-sm font-medium text-brown hover:bg-brown/5"
          >
            Back to home
          </Link>
        </div>

        {error.digest && (
          <p className="mt-5 text-xs text-brown/40">Reference: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
