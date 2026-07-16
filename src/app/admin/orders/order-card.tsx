"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatINR, ORDER_STATUS_LABEL, formatDateTime, cn } from "@/lib/utils";
import { formatKm, directionsUrl } from "@/lib/geo";
import type { OrderStatus, PaymentMethod } from "@/types/database";
import { updateOrderStatus, assignRider, setPayment } from "./actions";

export type AdminOrderItem = { item_name: string; quantity: number };
export type AdminOrder = {
  id: string;
  order_number: string | null;
  status: OrderStatus;
  total: number;
  payment_method: string;
  payment_status: string;
  placed_at: string;
  delivery_partner_id: string | null;
  customer_lat: number | null;
  customer_lng: number | null;
  delivery_otp: string | null;
  delivery_notes: string | null;
  delivery_address: Record<string, string> | null;
  order_items: AdminOrderItem[];
};

export type Rider = { id: string; full_name: string | null; phone: string | null };

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  pending: { to: "accepted", label: "Accept" },
  accepted: { to: "preparing", label: "Start preparing" },
  preparing: { to: "ready_for_pickup", label: "Mark ready" },
  ready_for_pickup: { to: "out_for_delivery", label: "Out for delivery" },
  out_for_delivery: { to: "delivered", label: "Mark delivered" },
};

const STATUS_PILL: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  accepted: "bg-blue-100 text-blue-800",
  preparing: "bg-indigo-100 text-indigo-800",
  ready_for_pickup: "bg-purple-100 text-purple-800",
  out_for_delivery: "bg-cyan-100 text-cyan-900",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function OrderCard({
  order,
  riders,
  distanceKm = null,
  radiusKm = null,
  kitchenLat = null,
  kitchenLng = null,
}: {
  order: AdminOrder;
  riders: Rider[];
  distanceKm?: number | null;
  radiusKm?: number | null;
  kitchenLat?: number | null;
  kitchenLng?: number | null;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const addr = order.delivery_address ?? {};
  const next = NEXT[order.status];
  const done = order.status === "delivered" || order.status === "cancelled";
  const items = order.order_items ?? [];
  const tooFar = distanceKm != null && radiusKm != null && distanceKm > radiusKm;
  const paid = order.payment_status === "paid";
  const payLabel =
    order.payment_method === "cod" ? "Cash" : order.payment_method === "upi" ? "Online (UPI)" : order.payment_method;

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setMsg(res.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  const fullAddress =
    [addr.house_number, addr.street, addr.landmark, addr.area, addr.city, addr.pincode].filter(Boolean).join(", ") ||
    "No address";
  const mapUrl =
    order.customer_lat != null && order.customer_lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${order.customer_lat},${order.customer_lng}`
      : null;

  return (
    <article className="rounded-2xl border border-brown/10 bg-soft p-5 shadow-card">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg text-coffee">
            #{order.order_number ?? order.id.slice(0, 8)}
            <span className="ml-3 text-sm font-normal text-brown/50">
              {formatDateTime(order.placed_at)}
            </span>
          </p>
        </div>
        <div className="text-right">
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", STATUS_PILL[order.status])}>
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </span>
          <p className="mt-1 font-semibold text-coffee">{formatINR(Number(order.total))}</p>
        </div>
      </div>

      {/* Items to prepare */}
      <div className="mt-4 rounded-xl border border-brown/10 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brown/50">Items to prepare</p>
        <ul className="mt-2 space-y-1.5">
          {items.length === 0 && <li className="text-sm text-brown/50">No items recorded.</li>}
          {items.map((i, idx) => (
            <li key={idx} className="flex items-center gap-3 text-sm text-coffee">
              <span className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full bg-gold-soft/60 px-1.5 text-xs font-bold text-coffee">
                ×{i.quantity}
              </span>
              <span className="font-medium">{i.item_name}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Deliver to */}
      <div className="mt-3 rounded-xl border border-brown/10 bg-white p-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-brown/50">Deliver to</p>
        <p className="mt-2 font-medium text-coffee">
          {addr.full_name ?? "Customer"}
          {addr.phone && (
            <a href={`tel:${addr.phone}`} className="ml-2 font-semibold text-gold-dark hover:underline">
              {addr.phone}
            </a>
          )}
        </p>
        <p className="mt-1 text-brown/75">{fullAddress}</p>

        {distanceKm != null && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                tooFar ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
              )}
            >
              {formatKm(distanceKm)} away (straight line)
              {tooFar && radiusKm != null && <> · outside your {radiusKm} km range</>}
            </span>
            {kitchenLat != null && kitchenLng != null && order.customer_lat != null && order.customer_lng != null && (
              <a
                href={directionsUrl(kitchenLat, kitchenLng, order.customer_lat, order.customer_lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-gold-dark hover:underline"
              >
                Road route &amp; time ↗
              </a>
            )}
          </div>
        )}
        {order.delivery_notes && <p className="mt-1 text-brown/60">Note: {order.delivery_notes}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {order.delivery_otp && (
            <span className="rounded-full bg-cream px-2 py-0.5 font-semibold text-coffee">Delivery OTP {order.delivery_otp}</span>
          )}
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-gold-dark hover:underline">
              Open location on map ↗
            </a>
          )}
        </div>
      </div>

      {/* Payment — you have the final word, since UPI never tells us the money landed */}
      <div className="mt-3 rounded-xl border border-brown/10 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brown/50">Payment</p>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              paid ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"
            )}
          >
            {paid ? `Paid · ${payLabel}` : `Unpaid · chose ${payLabel}`}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!paid ? (
            <>
              <span className="text-xs text-brown/60">Mark as received:</span>
              <button
                onClick={() => act(() => setPayment(order.id, "cod", "paid"))}
                disabled={pending}
                className="rounded-full bg-coffee px-3 py-1.5 text-xs font-semibold text-cream hover:bg-brown disabled:opacity-60"
              >
                Cash
              </button>
              <button
                onClick={() => act(() => setPayment(order.id, "upi", "paid"))}
                disabled={pending}
                className="rounded-full bg-coffee px-3 py-1.5 text-xs font-semibold text-cream hover:bg-brown disabled:opacity-60"
              >
                Online (UPI)
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-brown/60">Wrong? Change it:</span>
              {order.payment_method !== "cod" && (
                <button
                  onClick={() => act(() => setPayment(order.id, "cod", "paid"))}
                  disabled={pending}
                  className="rounded-full border border-brown/25 px-3 py-1.5 text-xs font-medium text-brown hover:bg-brown/5 disabled:opacity-60"
                >
                  Was cash
                </button>
              )}
              {order.payment_method !== "upi" && (
                <button
                  onClick={() => act(() => setPayment(order.id, "upi", "paid"))}
                  disabled={pending}
                  className="rounded-full border border-brown/25 px-3 py-1.5 text-xs font-medium text-brown hover:bg-brown/5 disabled:opacity-60"
                >
                  Was online
                </button>
              )}
              <button
                onClick={() => act(() => setPayment(order.id, order.payment_method as PaymentMethod, "pending"))}
                disabled={pending}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Mark unpaid
              </button>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      {!done && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {next && (
            <button
              onClick={() => act(() => updateOrderStatus(order.id, next.to))}
              disabled={pending}
              className="rounded-full bg-gold px-4 py-1.5 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-60"
            >
              {next.label}
            </button>
          )}
          {order.status === "pending" && (
            <button
              onClick={() => act(() => updateOrderStatus(order.id, "cancelled"))}
              disabled={pending}
              className="rounded-full border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Reject
            </button>
          )}

          <select
            value={order.delivery_partner_id ?? ""}
            onChange={(e) => act(() => assignRider(order.id, e.target.value || null))}
            disabled={pending}
            className="rounded-full border border-brown/20 bg-white px-3 py-1.5 text-sm text-brown outline-none focus:border-gold disabled:opacity-60"
          >
            <option value="">Assign rider…</option>
            {riders.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name ?? r.phone ?? r.id.slice(0, 8)}
              </option>
            ))}
          </select>

          {order.status !== "pending" && (
            <button
              onClick={() => act(() => updateOrderStatus(order.id, "cancelled"))}
              disabled={pending}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
    </article>
  );
}
