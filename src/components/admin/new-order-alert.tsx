"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bell, BellOff, AlarmClock, Volume2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatINR, formatDateTime, cn } from "@/lib/utils";
import { updateOrderStatus } from "@/app/admin/orders/actions";
import { waLink, newOrderMessage, type WaOrderInfo } from "@/lib/whatsapp";

type PendingOrder = {
  id: string;
  order_number: string | null;
  total: number;
  payment_method: string;
  payment_status: string;
  customer_lat: number | null;
  customer_lng: number | null;
  placed_at: string;
  delivery_address: Record<string, string> | null;
  order_items: { item_name: string; quantity: number }[];
};

type Siren = { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode };

const ENABLED_KEY = "dk_alerts_enabled";
const SNOOZE_KEY = "dk_alerts_snoozed_until";
const SNOOZE_IDS_KEY = "dk_alerts_snoozed_ids";
const SNOOZE_MS = 5 * 60 * 1000;

/**
 * Won't let an order be missed.
 *
 * Mounted in the ROOT layout, so it follows the admin onto every page — the
 * menu, the home page, anywhere. It renders nothing at all for customers and
 * riders. While ANY order sits unaccepted it blocks the screen and wails a
 * continuous siren until it's Accepted or Rejected. Snooze buys 5 minutes of
 * quiet — but a brand-new order rings straight through it.
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
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  const audioRef = useRef<AudioContext | null>(null);
  const sirenRef = useRef<Siren | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const enabledRef = useRef(false);

  const snoozing = snoozedUntil > now;
  const snoozeLeft = Math.max(0, Math.ceil((snoozedUntil - now) / 1000));
  // Snooze silences only the orders shown when you snoozed. A NEW order is not
  // in that set, so it stays visible and rings straight through the snooze.
  const visible = snoozing ? pending.filter((o) => !snoozedIds.has(o.id)) : pending;
  const snoozedCount = pending.length - visible.length;

  // Create / resume the audio context. Browsers only let sound start after a
  // user gesture, so this is also called on the first click/keypress.
  const ensureAudio = useCallback(async () => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      if (audioRef.current.state === "suspended") await audioRef.current.resume();
      if (audioRef.current.state === "running") setAudioReady(true);
    } catch {
      /* no audio available */
    }
    return audioRef.current;
  }, []);

  // A continuous, loud wailing siren (sawtooth pitch swept by an LFO). Runs until
  // stopped — this is what "alerts everyone" instead of a short beep.
  const startSiren = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx || ctx.state !== "running" || sirenRef.current) return;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 800;

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 3.2; // wail speed
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 420; // wail depth (±420 Hz around 800)
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.7, ctx.currentTime + 0.05); // LOUD
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    lfo.start();
    sirenRef.current = { osc, lfo, gain };
  }, []);

  const stopSiren = useCallback(() => {
    const s = sirenRef.current;
    const ctx = audioRef.current;
    if (!s) return;
    try {
      const t = ctx?.currentTime ?? 0;
      s.gain.gain.cancelScheduledValues(t);
      s.gain.gain.setValueAtTime(Math.max(0.0001, s.gain.gain.value), t);
      s.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      s.osc.stop(t + 0.1);
      s.lfo.stop(t + 0.1);
    } catch {
      /* already stopped */
    }
    sirenRef.current = null;
  }, []);

  // Short confirmation beep when the admin turns the alarm on.
  const testBeep = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx || ctx.state !== "running") return;
    [880, 1175, 880].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.6, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }, []);

  const loadPending = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select(
        "id, order_number, total, payment_method, payment_status, customer_lat, customer_lng, placed_at, delivery_address, order_items(item_name, quantity)"
      )
      .eq("status", "pending")
      .order("placed_at", { ascending: true });
    setPending((data ?? []) as unknown as PendingOrder[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enable() {
    await ensureAudio();
    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* dismissed */
      }
    }
    localStorage.setItem(ENABLED_KEY, "1");
    setEnabled(true);
    testBeep();
  }

  function disable() {
    localStorage.removeItem(ENABLED_KEY);
    stopSiren();
    audioRef.current?.close().catch(() => {});
    audioRef.current = null;
    setAudioReady(false);
    setEnabled(false);
  }

  function snooze() {
    stopSiren();
    const ids = pending.map((o) => o.id);
    const until = Date.now() + SNOOZE_MS;
    localStorage.setItem(SNOOZE_KEY, String(until));
    localStorage.setItem(SNOOZE_IDS_KEY, JSON.stringify(ids));
    setSnoozedIds(new Set(ids));
    setSnoozedUntil(until);
  }

  function clearSnooze() {
    setSnoozedUntil(0);
    setSnoozedIds(new Set());
    localStorage.removeItem(SNOOZE_KEY);
    localStorage.removeItem(SNOOZE_IDS_KEY);
  }

  function orderInfo(o: PendingOrder): WaOrderInfo {
    const addr = o.delivery_address ?? {};
    const address =
      [addr.house_number, addr.street, addr.landmark, addr.area, addr.city, addr.pincode]
        .filter(Boolean)
        .join(", ") || "No address";
    return {
      orderNumber: o.order_number ?? o.id.slice(0, 8),
      items: o.order_items ?? [],
      total: Number(o.total),
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      customerName: addr.full_name ?? null,
      customerPhone: addr.phone ?? null,
      address,
      lat: o.customer_lat,
      lng: o.customer_lng,
    };
  }

  function shareWhatsApp(o: PendingOrder) {
    window.open(waLink(null, newOrderMessage(orderInfo(o))), "_blank");
  }

  function decide(id: string, accept: boolean) {
    setBusyId(id);
    setPending((p) => p.filter((o) => o.id !== id));
    void (async () => {
      const res = await updateOrderStatus(id, accept ? "accepted" : "cancelled");
      if (!res.ok) await loadPending();
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
    try {
      const raw = localStorage.getItem(SNOOZE_IDS_KEY);
      if (raw) setSnoozedIds(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
    void loadPending();
  }, [isAdmin, loadPending]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Flash the tab title so a backgrounded tab visibly shows a waiting order.
  useEffect(() => {
    if (visible.length === 0) return;
    let on = false;
    const flip = () => {
      on = !on;
      document.title = on ? `🔴 (${visible.length}) NEW ORDER!` : "Das Kitchen — Orders";
    };
    flip();
    const t = setInterval(flip, 1000);
    return () => {
      clearInterval(t);
      document.title = "Das Kitchen — Orders";
    };
  }, [visible.length]);

  // Arm audio: create the context and resume it on the first interaction (this
  // is what lets sound work after a page reload, where the browser blocks it).
  useEffect(() => {
    if (!enabled) return;
    void ensureAudio();
    const arm = () => void ensureAudio();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, [enabled, ensureAudio]);

  // Keep the snooze countdown honest
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Any order change anywhere -> reload pending (live, no refresh)
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-pending-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        void loadPending();
        router.refresh();

        if (payload.eventType !== "INSERT") return;
        const o = payload.new as PendingOrder;
        if (seenRef.current.has(o.id)) return;
        seenRef.current.add(o.id);

        // Ring instantly (works in a background tab — WebSocket fires regardless).
        if (enabledRef.current) void ensureAudio().then(() => startSiren());

        if ("Notification" in window && Notification.permission === "granted") {
          const n = new Notification("🔔 NEW ORDER — Das Kitchen", {
            body: `#${o.order_number ?? ""} · ${formatINR(Number(o.total))} — tap to open`,
            icon: "/logo.png",
            tag: o.id,
            requireInteraction: true,
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, loadPending]);

  // The alarm: siren wails continuously while anything is waiting.
  useEffect(() => {
    if (visible.length > 0 && enabled && audioReady) {
      startSiren();
    } else {
      stopSiren();
    }
    return () => stopSiren();
  }, [visible.length, enabled, audioReady, startSiren, stopSiren]);

  const showModal = visible.length > 0;
  const soundBlocked = enabled && showModal && !audioReady;

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

      {mounted &&
        createPortal(
          <>
            {snoozing && snoozedCount > 0 && (
              <button
                onClick={clearSnooze}
                className="fixed bottom-4 right-4 z-[80] flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 shadow-warm"
              >
                <AlarmClock size={16} />
                {snoozedCount} snoozed · {Math.floor(snoozeLeft / 60)}:
                {String(snoozeLeft % 60).padStart(2, "0")}
              </button>
            )}

            {showModal && (
              <div className="fixed inset-0 z-[95] flex items-center justify-center bg-coffee/60 p-4 backdrop-blur-sm">
                <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-soft shadow-warm">
                  <div className="border-b border-brown/10 bg-gold-soft/40 px-6 py-4">
                    <p className="font-display text-2xl text-coffee">
                      {visible.length} new order{visible.length > 1 ? "s" : ""}
                    </p>
                    <p className="mt-0.5 text-sm text-brown/70">Accept or reject to stop the alarm.</p>
                  </div>

                  {soundBlocked && (
                    <button
                      onClick={() => void ensureAudio()}
                      className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-100 px-6 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-200"
                    >
                      <Volume2 size={16} /> Tap here to turn the sound on
                    </button>
                  )}

                  <div className="flex-1 space-y-3 overflow-y-auto p-5">
                    {visible.map((o) => {
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
                              type="button"
                              onClick={() => shareWhatsApp(o)}
                              className="rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95"
                            >
                              WhatsApp
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
                      {enabled ? "Siren wails until you decide." : "Sound is off — turn the alarm on in the header."}
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
          </>,
          document.body
        )}
    </>
  );
}
