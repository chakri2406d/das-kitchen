import { Navbar } from "@/components/layout/navbar";
import { Skeleton, SkeletonCards } from "@/components/ui/skeleton";

export default function CartLoading() {
  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-3 h-4 w-32" />
        <SkeletonCards count={3} className="mt-6" />
        <div className="mt-8 rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="mt-4 h-11 w-full rounded-full" />
        </div>
      </div>
    </main>
  );
}
