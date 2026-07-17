import { Navbar } from "@/components/layout/navbar";
import { Skeleton } from "@/components/ui/skeleton";

export default function CheckoutLoading() {
  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <Skeleton className="h-9 w-36" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4 rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
            <Skeleton className="h-6 w-40" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-1.5 h-9 w-full rounded-xl" />
                </div>
              ))}
            </div>
          </div>
          <div className="h-fit space-y-3 rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-11 w-full rounded-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
