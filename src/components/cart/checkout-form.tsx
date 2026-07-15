"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { placeOrder, validateCoupon, type CheckoutInput } from "@/app/(customer)/checkout/actions";
import { formatINR, cn } from "@/lib/utils";

const FIELDS: { key: keyof FormState; label: string; required?: boolean }[] = [
  { key: "fullName", label: "Full name", required: true },
  { key: "phone", label: "Phone number", required: true },
  { key: "houseNumber", label: "House / Flat no.", required: true },
  { key: "street", label: "Street / Colony" },
  { key: "landmark", label: "Landmark" },
  { key: "area", label: "Area", required: true },
  { key: "city", label: "City" },
  { key: "pincode", label: "Pincode", required: true },
];

type FormState = {
  fullName: string;
  phone: string;
  houseNumber: string;
  street: string;
  landmark: string;
  area: string;
  city: string;
  pincode: string;
};

type AppliedCoupon = { code: string; discount: number; label: string };

export function CheckoutForm({
  subtotal,
  deliveryFee,
  initialName = "",
  initialPhone = "",
}: {
  subtotal: number;
  deliveryFee: number;
  initialName?: string;
  initialPhone?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    fullName: initialName,
    phone: initialPhone,
    houseNumber: "",
    street: "",
    landmark: "",
    area: "",
    city: "",
    pincode: "",
  });
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locState, setLocState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  // Coupon
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  const discount = coupon?.discount ?? 0;
  const total = Math.max(0, subtotal - discount) + deliveryFee;

  function update(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setMissing((m) => m.filter((k) => k !== key));
  }

  async function applyCoupon() {
    setCouponMsg(null);
    setCouponBusy(true);
    const res = await validateCoupon(couponInput, subtotal);
    setCouponBusy(false);
    if (!res.ok) {
      setCoupon(null);
      setCouponMsg(res.error);
      return;
    }
    setCoupon({ code: res.code, discount: res.discount, label: res.label });
    setCouponMsg(null);
  }

  function removeCoupon() {
    setCoupon(null);
    setCouponInput("");
    setCouponMsg(null);
  }

  function captureLocation() {
    if (!("geolocation" in navigator)) {
      setLocState("error");
      return;
    }
    setLocState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocState("done");
      },
      () => setLocState("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const miss = FIELDS.filter((f) => f.required && !form[f.key].trim()).map((f) => f.key);
    if (miss.length > 0) {
      setMissing(miss);
      const labels = miss.map((k) => FIELDS.find((f) => f.key === k)!.label).join(", ");
      setError(`Please fill: ${labels}.`);
      const first = document.querySelector<HTMLInputElement>(`[name="${miss[0]}"]`);
      first?.focus();
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    const payload: CheckoutInput = {
      ...form,
      notes,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      couponCode: coupon?.code ?? null,
    };
    const res = await placeOrder(payload);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/orders?placed=${res.orderNumber}`);
    router.refresh();
  }

  const mapUrl = coords
    ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
    : null;

  return (
    <form onSubmit={submit} className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4 rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
        <h2 className="font-display text-xl text-coffee">Delivery details</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => {
            const isMissing = missing.includes(f.key);
            return (
              <div key={f.key}>
                <label className="text-xs font-medium text-brown/60">
                  {f.label}
                  {f.required && <span className="text-red-500"> *</span>}
                </label>
                <input
                  name={f.key}
                  value={form[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  aria-invalid={isMissing}
                  className={cn(
                    "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-gold",
                    isMissing ? "border-red-400 bg-red-50" : "border-brown/20"
                  )}
                />
              </div>
            );
          })}
        </div>

        <div>
          <label className="text-xs font-medium text-brown/60">Delivery notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-brown/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>

        <div className="rounded-xl border border-brown/15 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-coffee">Share your location</p>
              <p className="text-xs text-brown/60">Helps the rider find you faster.</p>
            </div>
            <button
              type="button"
              onClick={captureLocation}
              className="rounded-full border border-brown/25 px-4 py-1.5 text-sm font-medium text-brown hover:bg-brown/5"
            >
              {locState === "loading" ? "Locating…" : coords ? "Update" : "Use my location"}
            </button>
          </div>
          {locState === "done" && coords && (
            <div className="mt-2 text-xs text-green-700">
              <p>Location captured ✓ ({coords.lat.toFixed(5)}, {coords.lng.toFixed(5)})</p>
              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block font-semibold text-gold-dark underline"
                >
                  View on map to verify ↗
                </a>
              )}
            </div>
          )}
          {locState === "error" && (
            <p className="mt-2 text-xs text-red-600">
              Couldn&apos;t get location. You can still order with the address above.
            </p>
          )}
        </div>
      </div>

      <aside className="h-fit space-y-3 rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
        <h2 className="font-display text-xl text-coffee">Summary</h2>

        {/* Coupon */}
        {coupon ? (
          <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-green-800">{coupon.code} applied</p>
              <p className="text-xs text-green-700">{coupon.label}</p>
            </div>
            <button type="button" onClick={removeCoupon} className="text-xs font-medium text-red-600 hover:underline">
              Remove
            </button>
          </div>
        ) : (
          <div>
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCoupon();
                  }
                }}
                placeholder="Coupon code"
                className="w-full rounded-xl border border-brown/20 bg-white px-3 py-2 text-sm uppercase outline-none focus:border-gold"
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={couponBusy || !couponInput.trim()}
                className="rounded-xl border border-brown/25 px-4 text-sm font-medium text-brown hover:bg-brown/5 disabled:opacity-50"
              >
                {couponBusy ? "…" : "Apply"}
              </button>
            </div>
            {couponMsg && <p className="mt-1.5 text-xs text-red-600">{couponMsg}</p>}
          </div>
        )}

        <div className="flex justify-between text-sm text-brown/80">
          <span>Subtotal</span>
          <span>{formatINR(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm font-medium text-green-700">
            <span>Discount</span>
            <span>−{formatINR(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-brown/80">
          <span>Delivery fee</span>
          <span>{deliveryFee === 0 ? "Free" : formatINR(deliveryFee)}</span>
        </div>
        <div className="flex justify-between border-t border-brown/10 pt-3 font-semibold text-coffee">
          <span>Total</span>
          <span>{formatINR(total)}</span>
        </div>
        <p className="rounded-lg bg-cream px-3 py-2 text-xs text-brown/70">Payment: Cash on Delivery</p>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-coffee px-6 py-3 text-sm font-medium text-cream hover:bg-brown disabled:opacity-60"
        >
          {submitting ? "Placing order…" : `Place order · ${formatINR(total)}`}
        </button>
      </aside>
    </form>
  );
}
