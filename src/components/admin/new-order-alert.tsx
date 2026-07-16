"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, BellOff, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatINR, cn } from "@/lib/utils";

type Incoming = { id: string; order_number: string | null; total: number };

const STORAGE_KEY = "dk_alerts_enabled";

/**
 * Rings the kitchen when an order lands.
 *
 * Browsers block audio until the user interacts with the page, so alerts must be
 * switched on once per device with a real click — that's what the button is for.
 * The choice is remembered in localStorage.
 */
export function NewOrderAlert() {
  const supabase = createClient();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [queue, setQueue] = useState<Incoming[]>([]);
  const audioRef = useRef<AudioContext | null>(null);

  // A two-tone chime, synthesised — no audio file to load or host.
  const chime = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();

    // Repeat the pair 3x so it carries across a noisy kitchen.
    for (let rep = 0; rep < 3; rep++) {
      [880, 1175].forEach((freq, i) => {
        const t = ctx.currentTime + rep * 0.75 + i * 0.18;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.45);
      });
    }
  }, []);

  async function enable() {
    // Must be created inside a click for browsers to allow sound later.
    try {
      audioRef.current = new AudioContext();
      await audioRef.current.resume();
    } catch {
      // No audio available — notifications alone still work.
    }
    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* user dismissed */
      }
    }
    localStorage.setItem(STORAGE_KEY, "1");
    setEnabled(true);
    chime(); // instant proof it works
  }

  function disable() {
    localStorage.removeItem(STORAGE_KEY);
    audioRef.current?.close().catch(() => {});
    audioRef.current = null;
    setEnabled(false);
  }

  useEffect(() => {
    setEnabled(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-new-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const o = payload.new as Incoming;
        setQueue((q) => [o, ...q].slice(0, 5));
        router.refresh();

        if (!enabled) return;
        chime();
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("New order — Das Kitchen", {
            body: `#${o.order_number ?? ""} · ${formatINR(Number(o.total))}`,
            icon: "/logo.png",
            tag: o.id, // never stack duplicates for one order
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, chime]);

  return (
    <>
      <button
        onClick={enabled ? disable : enable}
        title={enabled ? "Alerts are on — click to mute" : "Turn on sound + notifications for new orders"}
        className={cn(
          "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
          enabled
            ? "bg-green-100 text-green-800 hover:bg-green-200"
            : "bg-amber-100 text-amber-900 hover:bg-amber-200"
        )}
      >
        {enabled ? <Bell size={14} /> : <BellOff size={14} />}
        <span className="hidden sm:inline">{enabled ? "Alerts on" : "Turn on alerts"}</span>
      </button>

      {/* Banner stack — stays until dismissed, so a missed chime isn't a missed order. */}
      {queue.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
          {queue.map((o) => (
            <div
              key={o.id}
              className="flex animate-fade-up items-center justify-between gap-3 rounded-2xl border border-gold/50 bg-soft p-4 shadow-warm"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-coffee">New order received</p>
                <p className="truncate text-xs text-brown/70">
                  #{o.order_number ?? o.id.slice(0, 8)} · {formatINR(Number(o.total))}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href="/admin/orders"
                  onClick={() => setQueue((q) => q.filter((x) => x.id !== o.id))}
                  className="rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-white hover:bg-gold-dark"
                >
                  View
                </Link>
                <button
                  onClick={() => setQueue((q) => q.filter((x) => x.id !== o.id))}
                  aria-label="Dismiss"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-brown/60 hover:bg-brown/5"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
