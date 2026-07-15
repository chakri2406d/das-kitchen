"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Confetti } from "@/components/ui/confetti";
import { ORDER_STATUS_LABEL, formatTime, cn } from "@/lib/utils";
import { distanceKm, etaMinutes, formatKm, osmEmbedUrl, osmLinkUrl } from "@/lib/geo";

type Rider = { full_name: string | null; phone: string | null };

const STEPS = ["pending", "accepted", "preparing", "ready_for_pickup", "out_for_delivery", "delivered"];

export function OrderTracker({
  orderId,
  initialStatus,
  customerLat,
  customerLng,
  rider,
}: {
  orderId: string;
  initialStatus: string;
  customerLat: number | null;
  customerLng: number | null;
  rider: Rider | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [pos, setPos] = useState<{ lat: number; lng: number; at: string } | null>(null);
  const [justDelivered, setJustDelivered] = useState(false);
  const statusRef = useRef(initialStatus);

  // Live order status
  useEffect(() => {
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const next = (payload.new as { status: string }).status;
          const prev = statusRef.current;
          statusRef.current = next;
          setStatus(next);

          if (prev !== "delivered" && next === "delivered") {
            // Show the thank-you first — refreshing now would unmount this card.
            setJustDelivered(true);
          } else {
            router.refresh();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Live rider position
  useEffect(() => {
    if (status !== "out_for_delivery") return;

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("delivery_tracking")
        .select("latitude, longitude, recorded_at")
        .eq("order_id", orderId)
        .order("recorded_at", { ascending: false })
        .limit(1);
      const row = data?.[0];
      if (row && !cancelled) setPos({ lat: row.latitude, lng: row.longitude, at: row.recorded_at });
    })();

    const channel = supabase
      .channel(`track-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "delivery_tracking", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const r = payload.new as { latitude: number; longitude: number; recorded_at: string };
          setPos({ lat: r.latitude, lng: r.longitude, at: r.recorded_at });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, status]);

  const stepIndex = STEPS.indexOf(status);
  const away =
    pos && customerLat != null && customerLng != null
      ? distanceKm(pos.lat, pos.lng, customerLat, customerLng)
      : null;

  if (status === "cancelled") return null;

  return (
    <>
      {justDelivered && <Confetti />}

      {/* Thank-you popup the moment the rider confirms the OTP */}
      {justDelivered && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-coffee/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-scale-in rounded-2xl bg-soft p-8 text-center shadow-warm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
              ✓
            </div>
            <h2 className="mt-4 font-display text-2xl text-coffee">Order delivered!</h2>
            <p className="mt-2 text-sm text-brown/75">
              Thank you for ordering from Das Kitchen. We hope you enjoy every bite — and we hope to
              see you again soon!
            </p>
            <button
              onClick={() => {
                setJustDelivered(false);
                router.refresh(); // now pull the final "Delivered" state
              }}
              className="mt-6 w-full rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-white hover:bg-gold-dark"
            >
              Thanks!
            </button>
          </div>
        </div>
      )}

      {/* Status timeline */}
      <div className="mt-4 rounded-xl border border-brown/10 bg-white p-4">
        <div className="flex items-center justify-between gap-1">
          {STEPS.slice(0, 5).map((s, i) => (
            <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full transition-colors",
                    i <= stepIndex ? "bg-gold" : "bg-brown/15"
                  )}
                />
                {i < 4 && (
                  <span className={cn("h-0.5 flex-1", i < stepIndex ? "bg-gold" : "bg-brown/15")} />
                )}
              </div>
              <span
                className={cn(
                  "text-center text-[10px] leading-tight",
                  i <= stepIndex ? "font-semibold text-coffee" : "text-brown/40"
                )}
              >
                {ORDER_STATUS_LABEL[s]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Live rider tracking */}
      {status === "out_for_delivery" && (
        <div className="mt-3 overflow-hidden rounded-xl border border-gold/40 bg-gold-soft/20">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <p className="text-sm font-semibold text-coffee">
                {rider?.full_name ? `${rider.full_name} is on the way` : "Your rider is on the way"}
              </p>
              <p className="mt-0.5 text-xs text-brown/70">
                {away != null ? (
                  <>
                    {formatKm(away)} away · arriving in about {etaMinutes(away)} min
                    {pos && <> · updated {formatTime(pos.at)}</>}
                  </>
                ) : (
                  "Waiting for the rider's location…"
                )}
              </p>
            </div>
            {rider?.phone && (
              <a
                href={`tel:${rider.phone}`}
                className="rounded-full border border-brown/25 bg-white px-4 py-1.5 text-sm font-medium text-brown hover:bg-brown/5"
              >
                Call rider
              </a>
            )}
          </div>

          {pos && (
            <>
              <iframe
                title="Live rider location"
                src={osmEmbedUrl(pos.lat, pos.lng)}
                className="h-56 w-full border-0"
                loading="lazy"
              />
              <div className="bg-white/60 px-4 py-2 text-right">
                <a
                  href={osmLinkUrl(pos.lat, pos.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-gold-dark hover:underline"
                >
                  Open bigger map ↗
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
