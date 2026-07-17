import { Navbar } from "@/components/layout/navbar";
import { Skeleton, SkeletonCards } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Skeleton className="h-9 w-40" />
        <SkeletonCards count={3} className="mt-6" />
      </div>
    </main>
  );
}
