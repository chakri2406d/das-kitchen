"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Menu, X, Instagram } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/#specials", label: "Today's Specials" },
  { href: "/#why", label: "Why Us" },
  { href: "/#visit", label: "Find us" },
  { href: "/#contact", label: "Contact" },
];

/** Hamburger + slide-in drawer. Phones get the full navigation the desktop has. */
export function MobileNav({
  signedIn,
  dashboardHref,
  dashboardLabel,
  instagramUrl,
}: {
  signedIn: boolean;
  dashboardHref: string;
  dashboardLabel: string;
  instagramUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Don't let the page scroll behind the drawer.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function signOut() {
    setOpen(false);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  // The drawer itself. Rendered through a portal (see below) so it attaches to
  // <body>, NOT inside the navbar's `backdrop-blur` header. A blurred/filtered
  // ancestor becomes the containing block for `position: fixed`, which would
  // otherwise trap this overlay inside the ~64px header and crush the links.
  const drawer = (
    <div className="fixed inset-0 z-[60] flex md:hidden">
      <div
        className="flex-1 bg-coffee/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <nav className="flex h-full w-[80%] max-w-xs animate-fade-up flex-col bg-cream shadow-warm">
        <div className="flex shrink-0 items-center justify-between border-b border-brown/10 px-5 py-4">
          <span className="font-display text-lg text-coffee">Das Kitchen</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-brown hover:bg-brown/5"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-4">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 text-base font-medium text-brown hover:bg-brown/5"
            >
              {l.label}
            </Link>
          ))}

          <div className="my-2 h-px bg-brown/10" />

          {signedIn ? (
            <>
              <Link
                href={dashboardHref}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-base font-medium text-brown hover:bg-brown/5"
              >
                {dashboardLabel}
              </Link>
              <Link
                href="/cart"
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-base font-medium text-brown hover:bg-brown/5"
              >
                My Cart
              </Link>
              <button
                onClick={signOut}
                className="mt-1 rounded-xl px-4 py-3 text-left text-base font-medium text-red-700 hover:bg-red-50"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-full bg-gold px-4 py-3 text-center text-base font-semibold text-white hover:bg-gold-dark"
            >
              Sign in
            </Link>
          )}
        </div>

        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-2 border-t border-brown/10 px-5 py-4 text-sm font-medium text-brown hover:text-gold"
        >
          <Instagram size={18} /> Follow us on Instagram
        </a>
      </nav>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex h-10 w-10 items-center justify-center rounded-full text-brown hover:bg-brown/5 md:hidden"
      >
        <Menu size={22} />
      </button>

      {/* `open` only becomes true after a client-side tap, so document.body is
          always available here — safe with server rendering. */}
      {open && createPortal(drawer, document.body)}
    </>
  );
}
