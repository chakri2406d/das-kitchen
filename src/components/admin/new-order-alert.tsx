"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, AlarmClock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatINR, formatDateTime, cn } from "@/lib/utils";
import { updateOrderStatus } from "@/app/admin/orders/actions";

type PendingOrder = {
  id: string;
  order_number: string | null;
  total: number;
  placed_at: string;
  delivery_address: Record<string, string> | null;
  order_items: { item_name: string; quantity: number }[];
};

const ENABLED_KEY = "dk_alerts_enabled";
const SNOOZE_KEY = "dk_alerts_snoozed_until";
const SNOOZE_MS = 5 * 60 * 1000;

// The burst below runs ~3.0s. Re-firing every 3.2s leaves a gap you can talk
// through but never one you could mistake for silence.
const BURST_MS = 3000;
const RING_EVERY_MS = 3200;

/**
 * Won't let an order be missed.
 *
 * Mounted in the ROOT layout, so it follows the admin onto every page — the
 * menu, the home page, anywhere. It renders nothing at all for customers and
 * riders. While ANY order sits unaccepted it blocks the screen and keeps
 * sounding until it's Accepted or Rejected. Snooze buys 5 minutes of quiet.
 *
 * It works off "orders that are still pending" rather than off realtime events,
 * so a refresh, a dropped connection or a closed laptop can't make an order
 * vanish — reopen the page and it's still shouting.
 */
export function NewOrderAlert() {
  const supabase = createClient();
  const router = useRouter();

  // Checked client-side on purpose: doing it on the server would drag a cookie
  // read into the root layout and make every page dynamic.
  const [isAdmin, setIsAdmin] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState<PendingOrder[]>([]);
  const [snoozedUntil, setSnoozedUntil] = useState<number>(0);
  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);

  const audioRef = useRef<AudioContext | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const snoozing = snoozedUntil > now;
  const snoozeLeft = Math.max(0, Math.ceil((snoozedUntil - now) / 1000));

  /**
   * A two-tone siren, not a polite ding.
   *
   * The old version was a quiet sine wave — fine in a silent room, useless in a
   * working kitchen. A square wave carries far more energy at the same peak
   * level, so it cuts through noise; the compressor keeps the sum from clipping
   * into a crackle. Two oscillators an octave apart give it body on phone
   * speakers, which can barely reproduce a bare 880 Hz sine.
   */
  const chime = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();

    const comp = ctx.createDynamicsCompressor();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(comp);
    comp.connect(ctx.destination);

    const start = ctx.currentTime + 0.02;
    const step = 0.3; // seconds per tone
    const steps = Math.round(BURST_MS / 1000 / step);

    for (let i = 0; i < steps; i++) {
      const t = start + i * step;
      const hi = i % 2 === 0 ? 880 : 1175; // the classic nee-naw
      for (const [type, freq, level] of [
        ["square", hi, 0.5],
        ["sine", hi / 2, 0.4],
      ] as const) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(level, t + 0.012);
        gain.gain.setValueAtTime(level, t + step - 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, t + step - 0.01);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + step);
      }
    }
  }, []);

  const loadPending = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, total, placed_at, delivery_address, order_items(item_name, quantity)")
      .eq("status", "pending")
      .order("placed_at", { ascending: true });
    setPending((data ?? []) as unknown as PendingOrder[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enable() {
    try {
      audioRef.current = new AudioContext();
      await audioRef.current.resume();
    } catch {
      /* no audio available — the modal still blocks */
    }
    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* dismissed */
      }
    }
    localStorage.setItem(ENABLED_KEY, "1");
    setEnabled(true);
    chime();
  }

  function disable() {
    localStorage.removeItem(ENABLED_KEY);
    audioRef.current?.close().catch(() => {});
    audioRef.current = null;
    setEnabled(false);
  }

  function snooze() {
    const until = Date.now() + SNOOZE_MS;
    localStorage.setItem(SNOOZE_KEY, String(until));
    setSnoozedUntil(until);
  }

  function decide(id: string, accept: boolean) {
    setBusyId(id);
    // Drop it from the list immediately so the alarm stops the instant you click.
    setPending((p) => p.filter((o) => o.id !== id));
    void (async () => {
      const res = await updateOrderStatus(id, accept ? "accepted" : "cancelled");
      if (!res.ok) await loadPending(); // put it back if the write failed
      setBusyId(null);
      router.refresh();
    })();
  }

  // Are we the admin? Everything else waits on this answer.
  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setIsAdmin(data?.role === "admin");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore preferences + first load
  useEffect(() => {
    if (!isAdmin) return;
    setEnabled(localStorage.getItem(ENABLED_KEY) === "1");
    setSnoozedUntil(Number(localStorage.getItem(SNOOZE_KEY) ?? 0));
    void loadPending();
  }, [isAdmin, loadPending]);

  // Keep the snooze countdown honest
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Any order change anywhere -> reload what's pending
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-pending-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        void loadPending();
        router.refresh();

        // A brand-new order also fires a desktop notification.
        if (payload.eventType !== "INSERT") return;
        const o = payload.new as PendingOrder;
        if (seenRef.current.has(o.id)) return;
        seenRef.current.add(o.id);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("New order — accept or reject", {
            body: `#${o.order_number ?? ""} · ${formatINR(Number(o.total))}`,
            icon: "/logo.png",
            tag: o.id,
            requireInteraction: true, // stays on screen until dealt with
          });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, loadPending]);

  // The alarm: re-ring while anything is waiting
  useEffect(() => {
    if (pending.length === 0 || !enabled || snoozing) return;
    chime(); // immediately…
    const t = setInterval(chime, RING_EVERY_MS); // …then keep going
    return () => clearInterval(t);
  }, [pending.length, enabled, snoozing, chime]);

  const showModal = pending.length > 0 && !snoozing;

  // Customers and riders never see or hear any of this.
  if (!isAdmin) return null;

  return (
    <>
      {/* Floats on every page now, so the alarm can always be armed or muted —
          and so you can see at a glance that it IS armed. */}
      <button
        onClick={enabled ? disable : enable}
        title={enabled ? "Alarm is on — click to mute" : "Turn on the new-order alarm"}
        className={cn(
          "fixed bottom-4 right-4 z-[70] flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold shadow-warm transition-colors",
          enabled
            ? "bg-green-100 text-green-800 hover:bg-green-200"
            : "animate-pulse bg-amber-200 text-amber-900 hover:bg-amber-300"
        )}
      >
        {enabled ? <Bell size={14} /> : <BellOff size={14} />}
        {enabled ? "Alarm on" : "Turn on alarm"}
      </button>

      {/* Snoozed: small nag so it's never truly out of sight */}
      {pending.length > 0 && snoozing && (
        <button
          onClick={() => setSnoozedUntil(0)}
          className="fixed bottom-16 right-4 z-[80] flex animate-fade-up items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 shadow-warm"
        >
          <AlarmClock size={16} />
          {pending.length} order{pending.length > 1 ? "s" : ""} waiting · {Math.floor(snoozeLeft / 60)}:
          {String(snoozeLeft % 60).padStart(2, "0")}
        </button>
      )}

      {/* The blocking alarm */}
      {showModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-coffee/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-lg animate-scale-in flex-col overflow-hidden rounded-2xl bg-soft shadow-warm">
            <div className="border-b border-brown/10 bg-gold-soft/40 px-6 py-4">
              <p className="font-display text-2xl text-coffee">
                {pending.length} new order{pending.length > 1 ? "s" : ""}
              </p>
              <p className="mt-0.5 text-sm text-brown/70">Accept or reject to stop the alarm.</p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {pending.map((o) => {
                const addr = o.delivery_address ?? {};
                return (
                  <div key={o.id} className="rounded-xl border border-brown/15 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display text-lg text-coffee">
                          #{o.order_number ?? o.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-brown/50">{formatDateTime(o.placed_at)}</p>
                      </div>
                      <p className="font-semibold text-coffee">{formatINR(Number(o.total))}</p>
                    </div>

                    <ul className="mt-3 space-y-1">
                      {(o.order_items ?? []).map((i, idx) => (
                        <li key={idx} className="flex items-center gap-2.5 text-sm text-coffee">
                          <span className="inline-flex h-5 min-w-[1.6rem] items-center justify-center rounded-full bg-gold-soft/60 px-1 text-xs font-bold">
                            ×{i.quantity}
                          </span>
                          {i.item_name}
                        </li>
                      ))}
                    </ul>

                    <p className="mt-2 text-xs text-brown/60">
                      {addr.full_name ?? "Customer"}
                      {addr.area ? ` · ${addr.area}` : ""}
                      {addr.phone ? ` · ${addr.phone}` : ""}
                    </p>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => decide(o.id, true)}
                        disabled={busyId === o.id}
                        className="flex-1 rounded-full bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Reject this order? The customer will see it cancelled.")) {
                            decide(o.id, false);
                          }
                        }}
                        disabled={busyId === o.id}
                        className="rounded-full border border-red-300 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-brown/10 px-5 py-3">
              <p className="text-xs text-brown/55">
                {enabled ? "Alarm rings every 8s until you decide." : "Sound is off — turn the alarm on in the header."}
              </p>
              <button
                onClick={snooze}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-brown/25 px-4 py-2 text-sm font-medium text-brown hover:bg-brown/5"
              >
                <AlarmClock size={15} /> Snooze 5 min
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
