"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * While the rider has an order out for delivery, push their GPS position every
 * ~20s so the customer can track them. maximumAge:0 forces a FRESH fix each time
 * (never a stale cached location), so the distance shown is where they are now.
 */
export function RiderPing({ orderId, riderId }: { orderId: string | null; riderId: string }) {
  const supabase = createClient();
  const lastSent = useRef(0);
  const [state, setState] = useState<"off" | "on" | "denied">("off");

  useEffect(() => {
    if (!orderId || !("geolocation" in navigator)) return;

    const watch = navigator.geolocation.watchPosition(
      async (pos) => {
        setState("on");
        const now = Date.now();
        if (now - lastSent.current < 20000) return; // throttle to 20s
        lastSent.current = now;

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        await supabase.from("delivery_tracking").insert({
          order_id: orderId,
          delivery_partner_id: riderId,
          latitude: lat,
          longitude: lng,
        });
        await supabase
          .from("delivery_partners")
          .update({ current_lat: lat, current_lng: lng })
          .eq("id", riderId);
      },
      () => setState("denied"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );

    return () => navigator.geolocation.clearWatch(watch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, riderId]);

  if (!orderId) return null;

  return (
    <p className="mt-3 rounded-xl bg-cream px-4 py-2 text-center text-xs text-brown/70">
      {state === "on" && "Location sharing on — the customer can see you approaching."}
      {state === "denied" && "Location blocked. Allow location so customers can track you."}
      {state === "off" && "Starting location sharing…"}
    </p>
  );
}
