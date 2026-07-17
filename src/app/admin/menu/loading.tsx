import { Skeleton, SkeletonCards } from "@/components/ui/skeleton";

export default function AdminMenuLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Skeleton className="h-9 w-28" />
      <Skeleton className="mt-3 h-4 w-72" />
      <Skeleton className="mt-6 h-32 w-full rounded-2xl" />
      <SkeletonCards count={4} className="mt-6" />
    </div>
  );
}
