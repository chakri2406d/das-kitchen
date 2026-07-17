import { Skeleton, SkeletonCards } from "@/components/ui/skeleton";

export default function DeliveryLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Skeleton className="h-9 w-48" />
      <div className="mt-5 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <SkeletonCards count={2} className="mt-6" />
    </div>
  );
}
