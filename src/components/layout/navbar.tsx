import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import type { BusinessStatus } from "@/types/database";

const STATUS_PILL: Record<BusinessStatus, { label: string; className: string }> = {
  open: { label: "Open now", className: "bg-green-100 text-green-800" },
  busy: { label: "Kitchen busy", className: "bg-amber-100 text-amber-900" },
  closed: { label: "Closed", className: "bg-red-100 text-red-800" },
};

export async function Navbar() {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("business_settings")
    .select("status")
    .eq("id", 1)
    .single();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let cartCount = 0;
  let role: string | null = null;
  if (user) {
    const [{ data: cart }, { data: profile }] = await Promise.all([
      supabase.from("cart_items").select("quantity").eq("user_id", user.id),
      supabase.from("profiles").select("role").eq("id", user.id).single(),
    ]);
    cartCount = (cart ?? []).reduce((sum, r) => sum + (r.quantity ?? 0), 0);
    role = profile?.role ?? null;
  }

  const status = (settings?.status ?? "open") as BusinessStatus;
  const pill = STATUS_PILL[status];

  return (
    <header className="sticky top-0 z-50 border-b border-brown/10 bg-cream/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo withWordmark />

        <div className="hidden items-center gap-7 text-sm font-medium text-brown md:flex">
          <Link href="/menu" className="hover:text-gold">Menu</Link>
          <Link href="/#specials" className="hover:text-gold">Today&apos;s Specials</Link>
          <Link href="/#why" className="hover:text-gold">Why Us</Link>
          <Link href="/#contact" className="hover:text-gold">Contact</Link>
          {user && (
            <Link href="/orders" className="hover:text-gold">My Orders</Link>
          )}
          {role === "admin" && (
            <Link href="/admin" className="font-semibold text-coffee hover:text-gold">Admin</Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className={`hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline ${pill.className}`}>
            {pill.label}
          </span>

          <Link
            href="/cart"
            className="relative rounded-full border border-brown/20 px-4 py-1.5 text-sm font-medium text-brown hover:bg-brown/5"
          >
            Cart
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-xs font-semibold text-white">
                {cartCount}
              </span>
            )}
          </Link>

          {user ? (
            <SignOutButton />
          ) : (
            <ButtonLink href="/login" variant="primary" size="sm">
              Sign in
            </ButtonLink>
          )}
        </div>
      </nav>
    </header>
  );
}
