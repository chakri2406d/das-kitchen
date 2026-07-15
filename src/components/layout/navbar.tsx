import Link from "next/link";
import { Instagram } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { CartBadge } from "@/components/cart/cart-badge";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { BUSINESS } from "@/lib/business";
import type { BusinessStatus } from "@/types/database";

const STATUS_PILL: Record<BusinessStatus, { label: string; className: string }> = {
  open: { label: "Open now", className: "bg-green-100 text-green-800" },
  busy: { label: "Kitchen busy", className: "bg-amber-100 text-amber-900" },
  closed: { label: "Closed", className: "bg-red-100 text-red-800" },
};

export async function Navbar() {
  const supabase = await createClient();
  const [{ data: settings }, profile] = await Promise.all([
    supabase.from("business_settings").select("status").eq("id", 1).single(),
    getCurrentProfile(),
  ]);

  const status = (settings?.status ?? "open") as BusinessStatus;
  const pill = STATUS_PILL[status];

  const dashboardHref =
    profile?.role === "admin" ? "/admin" : profile?.role === "delivery_partner" ? "/delivery" : "/orders";
  const dashboardLabel =
    profile?.role === "admin" ? "Admin" : profile?.role === "delivery_partner" ? "Deliveries" : "My Orders";

  return (
    <header className="sticky top-0 z-50 border-b border-brown/10 bg-cream/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Logo withWordmark />

        {/* Desktop links */}
        <div className="hidden items-center gap-7 text-sm font-medium text-brown md:flex">
          <Link href="/menu" className="hover:text-gold">Menu</Link>
          <Link href="/#specials" className="hover:text-gold">Today&apos;s Specials</Link>
          <Link href="/#why" className="hover:text-gold">Why Us</Link>
          <Link href="/#visit" className="hover:text-gold">Find us</Link>
          <Link href="/#contact" className="hover:text-gold">Contact</Link>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <span className={`hidden whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold sm:inline ${pill.className}`}>
            {pill.label}
          </span>

          <a
            href={BUSINESS.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Das Kitchen on Instagram"
            className="hidden h-9 w-9 items-center justify-center rounded-full text-brown transition-colors hover:bg-brown/5 hover:text-gold md:flex"
          >
            <Instagram size={18} />
          </a>

          {/* Cart stays visible on every screen — it's the money button. */}
          <CartBadge />

          {/* Desktop account actions */}
          <div className="hidden items-center gap-3 md:flex">
            {profile ? (
              <>
                <ButtonLink href={dashboardHref} variant="outline" size="sm" className="whitespace-nowrap">
                  {dashboardLabel}
                </ButtonLink>
                <SignOutButton />
              </>
            ) : (
              <ButtonLink href="/login" variant="primary" size="sm" className="whitespace-nowrap">
                Sign in
              </ButtonLink>
            )}
          </div>

          {/* Phones get the full menu in a drawer */}
          <MobileNav
            signedIn={!!profile}
            dashboardHref={dashboardHref}
            dashboardLabel={dashboardLabel}
            instagramUrl={BUSINESS.instagramUrl}
          />
        </div>
      </nav>
    </header>
  );
}
