/**
 * One-tap WhatsApp (click-to-chat) helpers — free, no API, no setup.
 * Opens WhatsApp with the message pre-filled; the sender taps Send.
 */

/** Build a wa.me link. If phone is empty, WhatsApp lets the sender pick a chat. */
export function waLink(phone: string | null | undefined, text: string): string {
  const digits = (phone ?? "").replace(/[^0-9]/g, "");
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

export type WaOrderInfo = {
  orderNumber: string;
  items: { item_name: string; quantity: number }[];
  total: number;
  paymentMethod: string; // 'cod' | 'upi' | ...
  paymentStatus: string; // 'paid' | 'pending' | ...
  customerName?: string | null;
  customerPhone?: string | null;
  address: string;
  lat?: number | null;
  lng?: number | null;
  deliveryOtp?: string | null;
  portalUrl?: string | null;
};

const rupees = (n: number) => `₹${Math.round(Number(n))}`;

function paymentLine(o: WaOrderInfo): string {
  const paid = o.paymentStatus === "paid";
  if (paid) {
    return o.paymentMethod === "upi"
      ? "💳 PREPAID (online) — collect nothing"
      : "💳 PAID — collect nothing";
  }
  return o.paymentMethod === "upi"
    ? `💰 NOT PAID — COLLECT ${rupees(o.total)} on delivery (UPI or cash)`
    : `💰 COLLECT ${rupees(o.total)} in CASH on delivery`;
}

/** Message for a delivery partner about an order assigned to them. */
export function riderOrderMessage(o: WaOrderInfo): string {
  const items = o.items.map((i) => `  • ${i.item_name} ×${i.quantity}`).join("\n");
  const nav =
    o.lat != null && o.lng != null
      ? `🧭 Navigate: https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}&travelmode=driving`
      : `🧭 Address: ${o.address}`;
  const lines = [
    `*Das Kitchen — Delivery #${o.orderNumber}*`,
    "",
    "🍽 Items:",
    items,
    "",
    `Order total: ${rupees(o.total)}`,
    paymentLine(o),
    "",
    `📍 ${o.customerName ?? "Customer"}${o.customerPhone ? ` · ${o.customerPhone}` : ""}`,
    o.address,
    nav,
  ];
  if (o.portalUrl) lines.push("", `Open in portal: ${o.portalUrl}`);
  return lines.join("\n");
}

/** Message the admin can forward when a new order comes in. */
export function newOrderMessage(o: WaOrderInfo): string {
  const items = o.items.map((i) => `  • ${i.item_name} ×${i.quantity}`).join("\n");
  const lines = [
    `*Das Kitchen — New order #${o.orderNumber}*`,
    "",
    "🍽 Items:",
    items,
    "",
    `Total: ${rupees(o.total)}`,
    paymentLine(o),
    "",
    `📍 ${o.customerName ?? "Customer"}${o.customerPhone ? ` · ${o.customerPhone}` : ""}`,
    o.address,
  ];
  if (o.lat != null && o.lng != null) {
    lines.push(
      `🧭 https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}&travelmode=driving`
    );
  }
  return lines.join("\n");
}
