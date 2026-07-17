"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin progress bar across the top of every page.
 *
 * Pages render on the server, so between a tap and the new page appearing there
 * is a gap where NOTHING moves — people assume their tap missed and tap again.
 * This shows instantly on any internal link click and disappears once the new
 * route is on screen.
 *
 * We listen for link clicks directly because the App Router doesn't expose
 * router events we could hook into.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);

  // Any internal link click -> start the bar
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (anchor.target && anchor.target !== "_self") return; // opens elsewhere
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return; // external
      // Same page (just a hash or identical URL) — nothing will load.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      setLoading(true);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // New route is on screen -> stop
  useEffect(() => {
    setLoading(false);
  }, [pathname, search]);

  // Never leave it stuck if a navigation is cancelled.
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoading(false), 10000);
    return () => clearTimeout(t);
  }, [loading]);

  if (!loading) return null;

  return (
    <div aria-hidden className="fixed inset-x-0 top-0 z-[100] h-0.5 bg-gold/15">
      <div className="animate-nav-progress h-full bg-gold shadow-[0_0_8px_rgba(176,141,0,0.7)]" />
    </div>
  );
}
