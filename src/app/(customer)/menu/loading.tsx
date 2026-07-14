import { Navbar } from "@/components/layout/navbar";

/**
 * Shown instantly while the menu server component fetches — so the click
 * on "See full menu" feels immediate instead of blank.
 */
export default function MenuLoading() {
  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-brown/10" />
        <div className="mt-3 h-4 w-64 animate-pulse rounded bg-brown/10" />

        <div className="mt-10 h-7 w-40 animate-pulse rounded bg-brown/10" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-brown/10 bg-soft p-5 shadow-card">
              <div className="h-5 w-3/4 animate-pulse rounded bg-brown/10" />
              <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-brown/10" />
              <div className="mt-6 flex items-center justify-between">
                <div className="h-5 w-16 animate-pulse rounded bg-brown/10" />
                <div className="h-8 w-20 animate-pulse rounded-full bg-brown/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
