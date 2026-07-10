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
    <Link href="/" className={cn("inline-flex items-center gap-2.5", className)} aria-label="Das Kitchen home">
      <Image
        src="/logo.png"
        alt="Das Kitchen"
        width={size}
        height={size}
        priority
        className="rounded-full"
      />
      {withWordmark && (
        <span className="font-display text-xl font-semibold text-coffee tracking-tight">
          Das Kitchen
        </span>
      )}
    </Link>
  );
}
