"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/riders", label: "Riders" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-coffee text-cream" : "text-brown hover:bg-brown/5"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
