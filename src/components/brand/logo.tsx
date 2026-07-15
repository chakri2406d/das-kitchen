import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  size = 44,
  withWordmark = false,
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <Link href="/" className={cn("inline-flex shrink-0 items-center gap-2.5", className)} aria-label="Das Kitchen home">
      <Image
        src="/logo.png"
        alt="Das Kitchen"
        width={size}
        height={size}
        priority
        className="shrink-0 rounded-full"
      />
      {withWordmark && (
        // Hidden on the narrowest phones so the header never wraps to two lines.
        <span className="hidden whitespace-nowrap font-display text-xl font-semibold tracking-tight text-coffee sm:inline">
          Das Kitchen
        </span>
      )}
    </Link>
  );
}
