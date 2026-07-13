"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { placeOrder, type CheckoutInput } from "@/app/(customer)/checkout/actions";
import { formatINR } from "@/lib/utils";

const FIELDS: { key: keyof FormState; label: string; required?: boolean; full?: boolean }[] = [
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

export function CheckoutForm({
  subtotal,
  deliveryFee,
}: {
  subtotal: number;
  deliveryFee: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    fullName: "",
    phone: "",
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

  const total = subtotal + deliveryFee;

  function update(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
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

    if (!form.fullName || !form.phone || !form.houseNumber || !form.area || !form.pincode) {
      setError("Please fill in name, phone, house/flat, area and pincode.");
      return;
    }

    setSubmitting(true);
    const payload: CheckoutInput = {
      ...form,
      notes,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
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

  return (
    <form onSubmit={submit} className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4 rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
        <h2 className="font-display text-xl text-coffee">Delivery details</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-medium text-brown/60">
                {f.label}
                {f.required && <span className="text-red-500"> *</span>}
              </label>
              <input
                value={form[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                className="mt-1 w-full rounded-xl border border-brown/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
              />
            </div>
          ))}
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
            <p className="mt-2 text-xs text-green-700">
              Location captured ✓ ({coords.lat.toFixed(5)}, {coords.lng.toFixed(5)})
            </p>
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
        <div className="flex justify-between text-sm text-brown/80">
          <span>Subtotal</span>
          <span>{formatINR(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-brown/80">
          <span>Delivery fee</span>
          <span>{deliveryFee === 0 ? "Free" : formatINR(deliveryFee)}</span>
        </div>
        <div className="flex justify-between border-t border-brown/10 pt-3 font-semibold text-coffee">
          <span>Total</span>
          <span>{formatINR(total)}</span>
        </div>
        <p className="rounded-lg bg-cream px-3 py-2 text-xs text-brown/70">
          Payment: Cash on Delivery
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
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
