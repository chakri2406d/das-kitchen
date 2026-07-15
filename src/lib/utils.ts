import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Indian Rupees, e.g. 249 -> ₹249 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Time — always India, never the server's timezone.
//
// These pages render on the server. On Vercel that server runs in UTC, so
// `new Date().toLocaleString()` would show UTC times to Indian customers and
// "today" would start at 05:30 IST. Everything below pins to Asia/Kolkata.
// ---------------------------------------------------------------------------
export const IST = "Asia/Kolkata";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // India has no DST

/** "15 Jul 2026, 4:25 am" — always in IST. */
export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "4:25 am" — always in IST. */
export function formatTime(iso: string | Date): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * The UTC instant that a window of `days` began in India, counting today as
 * day 1. days=1 -> midnight today IST; days=7 -> midnight 6 days ago IST.
 */
export function istRangeStartISO(days: number, now: Date = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const midnightUtcMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const startMs = midnightUtcMs - (Math.max(1, days) - 1) * 86_400_000;
  return new Date(startMs - IST_OFFSET_MS).toISOString();
}

/** The exact UTC instant that "today" began in India — for day-based queries. */
export function istDayStartISO(now: Date = new Date()): string {
  return istRangeStartISO(1, now);
}

/** Human-readable labels for order statuses (customer-facing wording). */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Order placed",
  accepted: "Accepted",
  preparing: "Preparing your food",
  ready_for_pickup: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Build a Google Maps navigation deep-link (free, no Directions API). */
export function mapsNavUrl(destLat: number, destLng: number, originLat?: number, originLng?: number) {
  const base = "https://www.google.com/maps/dir/?api=1";
  const origin = originLat != null && originLng != null ? `&origin=${originLat},${originLng}` : "";
  return `${base}${origin}&destination=${destLat},${destLng}&travelmode=driving`;
}
