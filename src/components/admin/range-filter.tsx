"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { RANGES, DEFAULT_RANGE, type RangeKey } from "@/lib/ranges";

/** Quick date-range chips. The choice lives in the URL, so it survives refresh. */
export function RangeFilter({ current }: { current: RangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function pick(key: RangeKey) {
    const next = new URLSearchParams(params.toString());
    if (key === DEFAULT_RANGE) next.delete("range");
    else next.set("range", key);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {(Object.keys(RANGES) as RangeKey[]).map((key) => (
        <button
          key={key}
          onClick={() => pick(key)}
          className={cn(
            "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            current === key ? "bg-coffee text-cream" : "bg-brown/5 text-brown hover:bg-brown/10"
          )}
        >
          {RANGES[key].label}
        </button>
      ))}
    </div>
  );
}
