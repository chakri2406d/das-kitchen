"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatINR, ORDER_STATUS_LABEL, mapsNavUrl, formatDateTime, cn } from "@/lib/utils";
import type { OrderStatus, PaymentMethod } from "@/types/database";
import { UpiQr } from "@/components/payments/upi-qr";
import { startDelivery, completeDelivery } from "./actions";

export type RiderOrderItem = { item_name: string; quantity: number };
export type RiderOrder = {
  id: string;
  order_number: string | null;
  status: OrderStatus;
  total: number;
  payment_method: string;
  payment_status: string;
  placed_at: string;
  customer_lat: number | null;
  customer_lng: number | null;
  delivery_notes: string | null;
  delivery_address: Record<string, string> | null;
  order_items: RiderOrderItem[];
};

const STATUS_PILL: Partial<Record<OrderStatus, string>> = {
  accepted: "bg-blue-100 text-blue-800",
  preparing: "bg-indigo-100 text-indigo-800",
  ready_for_pickup: "bg-purple-100 text-purple-800",
  out_for_delivery: "bg-cyan-100 text-cyan-900",
  delivered: "bg-green-100 text-green-800",
};

export function DeliveryOrderCard({
  order,
  upiId = null,
  upiName = "Das Kitchen",
}: {
  order: RiderOrder;
  upiId?: string | null;
  upiName?: string;
}) {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  // Rider must say how it was paid BEFORE the OTP — that's the order of events
  // at the door, and it's what keeps the cash/online split honest.
  const [paidBy, setPaidBy] = useState<PaymentMethod | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const addr = order.delivery_address ?? {};
  const fullAddress =
    [addr.house_number, addr.street, addr.landmark, addr.area, addr.city, addr.pincode].filter(Boolean).join(", ") ||
    "No address given";

  const hasPin = order.customer_lat != null && order.customer_lng != null;
  const navUrl = hasPin
    ? mapsNavUrl(order.customer_lat as number, order.customer_lng as number)
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  const collectCash = order.payment_method === "cod" && order.payment_status !== "paid";

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setErr(res.error ?? "Something went wrong.");
        return;
      }
      if (res.message) setMsg(res.message);
      router.refresh(); // pull fresh data so the order moves out of "active"
    });
  }

  return (
    <article className="rounded-2xl border border-brown/10 bg-soft p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg text-coffee">#{order.order_number ?? order.id.slice(0, 8)}</p>
          <p className="text-xs text-brown/50">{formatDateTime(order.placed_at)}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            STATUS_PILL[order.status] ?? "bg-cream text-coffee"
          )}
        >
          {ORDER_STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      {/* What to carry */}
      <div className="mt-4 rounded-xl border border-brown/10 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brown/50">Order</p>
        <ul className="mt-2 space-y-1">
          {(order.order_items ?? []).map((i, idx) => (
            <li key={idx} className="flex items-center gap-3 text-sm text-coffee">
              <span className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full bg-gold-soft/60 px-1.5 text-xs font-bold">
                ×{i.quantity}
              </span>
              <span className="font-medium">{i.item_name}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Where + who */}
      <div className="mt-3 rounded-xl border border-brown/10 bg-white p-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-brown/50">Deliver to</p>
        <p className="mt-2 font-medium text-coffee">{addr.full_name ?? "Customer"}</p>
        <p className="mt-1 text-brown/75">{fullAddress}</p>
        {order.delivery_notes && <p className="mt-1 text-brown/60">Note: {order.delivery_notes}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          {addr.phone && (
            <a
              href={`tel:${addr.phone}`}
              className="rounded-full border border-brown/25 px-4 py-1.5 text-sm font-medium text-brown hover:bg-brown/5"
            >
              Call customer
            </a>
          )}
          <a
            href={navUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-coffee px-4 py-1.5 text-sm font-medium text-cream hover:bg-brown"
          >
            Navigate
          </a>
          {!hasPin && <span className="self-center text-xs text-brown/50">No GPS pin — using address</span>}
        </div>
      </div>

      {/* Money */}
      <div className="mt-3 flex items-center justify-between rounded-xl bg-cream px-4 py-3">
        <span className="text-sm text-brown/70">
          {collectCash ? "Collect cash on delivery" : "Already paid — collect nothing"}
        </span>
        <span className={cn("font-semibold", collectCash ? "text-coffee" : "text-green-700")}>
          {formatINR(Number(order.total))}
        </span>
      </div>

      {/* Actions */}
      {order.status === "ready_for_pickup" && (
        <button
          onClick={() => run(() => startDelivery(order.id))}
          disabled={pending}
          className="mt-4 w-full rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-60"
        >
          {pending ? "Updating…" : "Picked up — start delivery"}
        </button>
      )}

      {order.status === "out_for_delivery" && (
        <div className="mt-4 rounded-xl border border-gold/40 bg-gold-soft/20 p-4">
          <p className="text-sm font-medium text-coffee">Finish the delivery</p>

          {/* Step 1 — how did they pay? */}
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brown/50">
            Step 1 · How did they pay?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setPaidBy("cod")}
              className={cn(
                "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                paidBy === "cod" ? "bg-coffee text-cream" : "bg-white text-brown hover:bg-brown/5"
              )}
            >
              Cash · {formatINR(Number(order.total))}
            </button>
            <button
              type="button"
              onClick={() => setPaidBy("upi")}
              disabled={!upiId}
              title={upiId ? undefined : "Add your UPI ID in Admin > Settings first"}
              className={cn(
                "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                paidBy === "upi" ? "bg-coffee text-cream" : "bg-white text-brown hover:bg-brown/5"
              )}
            >
              Paid online
            </button>
          </div>

          {/* Show the QR so they can pay right here */}
          {paidBy === "upi" && upiId && (
            <div className="mt-3 rounded-xl border border-brown/15 bg-white p-4">
              <p className="mb-3 text-center text-xs text-brown/60">
                Let them scan this, then confirm once you see the payment.
              </p>
              <UpiQr
                upiId={upiId}
                payeeName={upiName}
                amount={Number(order.total)}
                note={`Das Kitchen ${order.order_number ?? ""}`.trim()}
                size={168}
                compact
              />
            </div>
          )}
          {paidBy === "upi" && !upiId && (
            <p className="mt-2 text-xs text-red-600">
              No UPI ID set yet — add one in Admin &gt; Settings.
            </p>
          )}

          {/* Step 2 — OTP */}
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brown/50">
            Step 2 · Enter their 4-digit OTP
          </p>
          <p className="mt-1 text-xs text-brown/70">
            Ask the customer for the OTP shown on their order screen.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              placeholder="1234"
              disabled={!paidBy}
              className="w-28 rounded-xl border border-brown/20 bg-white px-4 py-2 text-center text-lg font-bold tracking-widest outline-none focus:border-gold disabled:bg-brown/5"
            />
            <button
              onClick={() => paidBy && run(() => completeDelivery(order.id, otp, paidBy))}
              disabled={pending || !paidBy || otp.length < 4}
              className="flex-1 rounded-full bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {pending ? "Confirming…" : "Confirm delivered"}
            </button>
          </div>
          {!paidBy && (
            <p className="mt-2 text-xs text-brown/55">Choose cash or online first.</p>
          )}
        </div>
      )}

      {(order.status === "accepted" || order.status === "preparing") && (
        <p className="mt-4 rounded-xl bg-cream px-4 py-3 text-center text-sm text-brown/60">
          Kitchen is still preparing this. You&apos;ll be able to pick it up once it&apos;s marked ready.
        </p>
      )}

      {msg && <p className="mt-2 text-sm font-medium text-green-700">{msg}</p>}
      {err && <p className="mt-2 text-sm font-medium text-red-600">{err}</p>}
    </article>
  );
}
