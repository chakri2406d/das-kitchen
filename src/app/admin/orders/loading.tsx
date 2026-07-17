import { Skeleton, SkeletonCards } from "@/components/ui/skeleton";

export default function AdminOrdersLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Skeleton className="h-9 w-32" />
      <Skeleton className="mt-3 h-4 w-80" />
      <Skeleton className="mt-8 h-6 w-28" />
      <SkeletonCards count={3} className="mt-4" />
    </div>
  );
}
