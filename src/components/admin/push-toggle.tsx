"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** VAPID keys travel as URL-safe base64; the browser wants raw bytes. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Registers THIS device to receive new-order pushes — the alert that still
 * arrives when the browser is shut and the phone is in a pocket.
 */
export function PushToggle() {
  const [state, setState] = useState<"unknown" | "off" | "on" | "busy" | "unsupported">("unknown");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub && Notification.permission === "granted" ? "on" : "off");
      } catch {
        setState("off");
      }
    })();
  }, []);

  async function enable() {
    setMsg(null);
    setState("busy");
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setMsg("Push isn't configured on the server yet.");
        setState("off");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMsg("Notifications are blocked. Allow them in your browser settings.");
        setState("off");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
        }));

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });

      if (!res.ok) {
        setMsg("Couldn't save this device. Try again.");
        setState("off");
        return;
      }
      setState("on");
      setMsg("This device will now be alerted for new orders.");
    } catch {
      setMsg("Couldn't turn on alerts on this device.");
      setState("off");
    }
  }

  if (state === "unsupported") return null;

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={state === "on" ? undefined : enable}
        disabled={state === "busy" || state === "on"}
        title={
          state === "on"
            ? "This device gets new-order alerts even when the app is closed"
            : "Get new-order alerts on this device, even when the app is closed"
        }
        className={cn(
          "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
          state === "on"
            ? "bg-green-100 text-green-800"
            : "bg-coffee text-cream hover:bg-brown disabled:opacity-60"
        )}
      >
        {state === "on" ? <BellRing size={14} /> : <BellOff size={14} />}
        <span className="hidden sm:inline">
          {state === "on" ? "Phone alerts on" : state === "busy" ? "Enabling…" : "Enable phone alerts"}
        </span>
      </button>
      {msg && <span className="mt-1 max-w-[14rem] text-right text-[11px] text-brown/60">{msg}</span>}
    </div>
  );
}
