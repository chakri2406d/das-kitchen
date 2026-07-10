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
