"use client";

import { useState, useTransition } from "react";
import { cn, formatINR } from "@/lib/utils";
import { osmEmbedUrl, quoteDelivery } from "@/lib/geo";
import { looksLikeUpiId } from "@/lib/upi";
import { UpiQr } from "@/components/payments/upi-qr";
import type { BusinessSettings, BusinessStatus } from "@/types/database";
import { setBusinessStatus, updateSettings } from "./actions";

const STATUS_OPTIONS: { value: BusinessStatus; label: string; active: string }[] = [
  { value: "open", label: "Open", active: "bg-green-600 text-white" },
  { value: "busy", label: "Busy", active: "bg-amber-500 text-white" },
  { value: "closed", label: "Closed", active: "bg-red-600 text-white" },
];

function num(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Keeps a number box honest as you type.
 *
 * These fields start at "0". Typing "20" into one lands you with "010" — which
 * reads back as 10, not 20, and you'd never notice until a customer was
 * undercharged. Strip the leading zero and only allow digits and one dot.
 */
function cleanNum(v: string): string {
  const only = v.replace(/[^\d.]/g, "");
  const [head = "", ...rest] = only.split(".");
  const int = head.replace(/^0+(?=\d)/, "");
  return rest.length > 0 ? `${int || "0"}.${rest.join("").slice(0, 2)}` : int;
}

export function SettingsForm({ settings }: { settings: BusinessSettings }) {
  const [status, setStatus] = useState<BusinessStatus>(settings.status);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    settings.kitchen_lat != null && settings.kitchen_lng != null
      ? { lat: settings.kitchen_lat, lng: settings.kitchen_lng }
      : null
  );
  const [locBusy, setLocBusy] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    is_accepting_orders: settings.is_accepting_orders,
    min_order_amount: String(settings.min_order_amount ?? 0),
    delivery_fee: String(settings.delivery_fee ?? 0),
    delivery_radius_km: String(settings.delivery_radius_km ?? 0),
    extra_km_fee: String(settings.extra_km_fee ?? 0),
    max_delivery_km: settings.max_delivery_km != null ? String(settings.max_delivery_km) : "",
    kitchen_address: settings.kitchen_address ?? "",
    phone: settings.phone ?? "",
    whatsapp: settings.whatsapp ?? "",
    email: settings.email ?? "",
    fssai_license: settings.fssai_license ?? "",
    open_time: settings.open_time ?? "",
    close_time: settings.close_time ?? "",
    upi_id: settings.upi_id ?? "",
    upi_name: settings.upi_name ?? "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Everything on this page is saved by one button, so it needs to be obvious
  // when there's something waiting to be saved. Comparing against the last
  // saved snapshot is cheap and never lies.
  const snapshot = JSON.stringify({ form, coords });
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setMsg(null); // an old "Settings saved." next to a fresh edit is a lie
  }

  function changeStatus(next: BusinessStatus) {
    const prev = status;
    setStatus(next);
    startTransition(async () => {
      const res = await setBusinessStatus(next);
      if (!res.ok) {
        setStatus(prev);
        setMsg(res.error);
      } else {
        setMsg("Kitchen status updated.");
      }
    });
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await updateSettings({
        is_accepting_orders: form.is_accepting_orders,
        kitchen_lat: coords?.lat ?? null,
        kitchen_lng: coords?.lng ?? null,
        min_order_amount: num(form.min_order_amount),
        delivery_fee: num(form.delivery_fee),
        delivery_radius_km: num(form.delivery_radius_km),
        extra_km_fee: num(form.extra_km_fee),
        max_delivery_km: form.max_delivery_km.trim() === "" ? null : num(form.max_delivery_km),
        kitchen_address: form.kitchen_address,
        phone: form.phone,
        whatsapp: form.whatsapp,
        email: form.email,
        fssai_license: form.fssai_license,
        open_time: form.open_time,
        close_time: form.close_time,
        upi_id: form.upi_id,
        upi_name: form.upi_name,
      });
      if (res.ok) setSavedSnapshot(snapshot);
      setMsg(res.ok ? "Settings saved." : res.error);
    });
  }

  const field = "w-full rounded-xl border border-brown/20 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold";
  const labelCls = "text-sm font-medium text-brown";

  // Live preview of the distance rule, so you can see what a far-away customer
  // will actually be charged before you save it.
  const pricing = {
    baseFee: num(form.delivery_fee),
    freeRadiusKm: num(form.delivery_radius_km),
    perKmFee: num(form.extra_km_fee),
    maxKm: form.max_delivery_km.trim() === "" ? null : num(form.max_delivery_km),
  };
  const previewKm = [2, 5, 8, 12];  // 5 km is the example Surya reasons about
  const chargesExtra = pricing.perKmFee > 0 && pricing.freeRadiusKm > 0;

  return (
    <div className="space-y-8">
      {/* Kitchen status */}
      <section className="rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
        <h2 className="font-display text-xl text-coffee">Kitchen status</h2>
        <p className="mt-1 text-sm text-brown/60">Shown to customers as a live badge. &ldquo;Closed&rdquo; also stops new orders.</p>
        <div className="mt-4 flex gap-2">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => changeStatus(o.value)}
              disabled={pending}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
                status === o.value ? o.active : "bg-cream text-brown hover:bg-brown/5"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-brown">
          <input
            type="checkbox"
            checked={form.is_accepting_orders}
            onChange={(e) => set("is_accepting_orders", e.target.checked)}
            className="h-4 w-4 accent-gold"
          />
          Accepting online orders
        </label>
      </section>

      {/* Online payments — UPI QR */}
      <section className="rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
        <h2 className="font-display text-xl text-coffee">Online payments (UPI)</h2>
        <p className="mt-1 text-sm text-brown/60">
          Add your UPI ID and customers can scan a QR to pay you directly — no gateway, no fees, no
          KYC. Money reaches your account instantly. Leave blank to stay cash-only.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className={labelCls}>UPI ID</span>
            <input
              className={field}
              placeholder="daskitchen@okaxis"
              value={form.upi_id}
              onChange={(e) => set("upi_id", e.target.value)}
            />
            {form.upi_id.trim() !== "" && !looksLikeUpiId(form.upi_id) && (
              <p className="mt-1 text-xs text-red-600">
                That doesn&apos;t look like a UPI ID — it should look like name@bank.
              </p>
            )}
          </div>
          <div>
            <span className={labelCls}>Payee name (shown in their UPI app)</span>
            <input
              className={field}
              placeholder="Das Kitchen"
              value={form.upi_name}
              onChange={(e) => set("upi_name", e.target.value)}
            />
          </div>
        </div>

        {looksLikeUpiId(form.upi_id) && (
          <div className="mt-5 rounded-xl border border-brown/15 bg-white p-5">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-brown/50">
              Preview — scan this to check it opens your account
            </p>
            <UpiQr
              upiId={form.upi_id.trim()}
              payeeName={form.upi_name.trim() || "Das Kitchen"}
              amount={1}
              note="Das Kitchen test"
              size={168}
              compact
            />
            <p className="mt-3 text-center text-xs text-brown/55">
              Test with ₹1 before going live. Remember to press Save settings.
            </p>
          </div>
        )}

        <p className="mt-4 rounded-lg bg-cream px-3 py-2 text-xs text-brown/70">
          <strong>Note:</strong> UPI has no way to tell this website that money arrived. Your rider
          confirms at the door, or you confirm in Orders. Nothing is marked paid automatically.
        </p>
      </section>

      {/* Kitchen location — powers distance + delivery radius */}
      <section className="rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
        <h2 className="font-display text-xl text-coffee">Kitchen location</h2>
        <p className="mt-1 text-sm text-brown/60">
          Set this once, standing at the kitchen. It powers the &ldquo;how far away&rdquo; figure on every
          order and the delivery-radius check.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLocErr(null);
              if (!("geolocation" in navigator)) {
                setLocErr("This browser can't share location.");
                return;
              }
              setLocBusy(true);
              navigator.geolocation.getCurrentPosition(
                (p) => {
                  setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
                  setLocBusy(false);
                },
                () => {
                  setLocErr("Couldn't get location — allow it, or paste coordinates below.");
                  setLocBusy(false);
                },
                { enableHighAccuracy: true, timeout: 10000 }
              );
            }}
            disabled={locBusy}
            className="rounded-full bg-coffee px-5 py-2 text-sm font-medium text-cream hover:bg-brown disabled:opacity-60"
          >
            {locBusy ? "Locating…" : coords ? "Update to my location" : "Use my current location"}
          </button>
          {coords && (
            <button
              type="button"
              onClick={() => setCoords(null)}
              className="rounded-full border border-brown/25 px-4 py-2 text-sm text-brown hover:bg-brown/5"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className={labelCls}>Latitude</span>
            <input
              className={field}
              inputMode="decimal"
              placeholder="17.44263"
              value={coords?.lat ?? ""}
              onChange={(e) => {
                const lat = Number(e.target.value);
                setCoords((c) => ({ lat: Number.isFinite(lat) ? lat : 0, lng: c?.lng ?? 0 }));
              }}
            />
          </div>
          <div>
            <span className={labelCls}>Longitude</span>
            <input
              className={field}
              inputMode="decimal"
              placeholder="78.48313"
              value={coords?.lng ?? ""}
              onChange={(e) => {
                const lng = Number(e.target.value);
                setCoords((c) => ({ lat: c?.lat ?? 0, lng: Number.isFinite(lng) ? lng : 0 }));
              }}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-brown/50">
          Tip: in Google Maps, right-click your kitchen &rarr; click the coordinates to copy them, then paste here.
        </p>
        {locErr && <p className="mt-2 text-sm text-red-600">{locErr}</p>}

        {coords && coords.lat !== 0 && coords.lng !== 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-brown/15">
            <iframe
              title="Kitchen location"
              src={osmEmbedUrl(coords.lat, coords.lng)}
              className="h-52 w-full border-0"
              loading="lazy"
            />
            <p className="bg-white px-4 py-2 text-xs text-brown/60">
              Check the pin is on your kitchen. Remember to press <strong>Save settings</strong> below.
            </p>
          </div>
        )}
      </section>

      {/* Distance pricing — how far we go, and what it costs */}
      <section className="rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
        <h2 className="font-display text-xl text-coffee">Delivering further away</h2>
        <p className="mt-1 text-sm text-brown/60">
          Inside your radius the flat delivery fee applies. Beyond it, you can either refuse the
          order or charge extra per km — your choice.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className={labelCls}>Extra charge per km beyond the radius (₹)</span>
            <input
              className={field}
              inputMode="decimal"
              placeholder="0"
              value={form.extra_km_fee}
              onFocus={(e) => e.target.select()}
              onChange={(e) => set("extra_km_fee", cleanNum(e.target.value))}
            />
            <p className="mt-1 text-xs text-brown/55">
              Leave at <strong>0</strong> to keep refusing orders outside {pricing.freeRadiusKm || 0} km.
            </p>
          </div>
          <div>
            <span className={labelCls}>Never deliver further than (km)</span>
            <input
              className={field}
              inputMode="decimal"
              placeholder="No limit"
              value={form.max_delivery_km}
              onFocus={(e) => e.target.select()}
              onChange={(e) => set("max_delivery_km", cleanNum(e.target.value))}
            />
            <p className="mt-1 text-xs text-brown/55">
              A hard stop, whatever the extra charge. Blank = no limit.
            </p>
          </div>
        </div>

        {chargesExtra ? (
          <div className="mt-5 rounded-xl border border-brown/15 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brown/50">
              What customers will pay
            </p>
            <ul className="mt-2 space-y-2 text-sm">
              {previewKm.map((km) => {
                const q = quoteDelivery(km, pricing);
                return (
                  <li key={km} className="flex items-start justify-between gap-3">
                    <span className="text-brown/70">{km} km away</span>
                    {q.refusal ? (
                      <span className="text-xs font-semibold text-red-700">Order refused</span>
                    ) : (
                      <span className="text-right">
                        <span className="font-semibold text-coffee">
                          {q.fee === 0 ? "Free" : formatINR(q.fee)}
                        </span>
                        {q.extraFee > 0 ? (
                          <span className="block text-xs font-normal text-brown/55">
                            {q.extraKm} km past {pricing.freeRadiusKm} km × {formatINR(pricing.perKmFee)}
                            {pricing.baseFee > 0 && <> + {formatINR(pricing.baseFee)} base</>}
                          </span>
                        ) : (
                          <span className="block text-xs font-normal text-brown/55">
                            inside your {pricing.freeRadiusKm} km area
                          </span>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-brown/55">
              Part of a km counts as a full km. Distance is measured straight-line from the kitchen,
              so it is always a little less than the road — the customer never over-pays.
            </p>
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-cream px-3 py-2 text-xs text-brown/70">
            Right now, anyone outside {pricing.freeRadiusKm || 0} km is told you don&apos;t deliver to
            them. Put a rupee amount above to accept those orders and charge for the extra distance.
          </p>
        )}

        <p className="mt-3 text-xs text-brown/50">
          Customers who don&apos;t share their location can&apos;t be measured, so they pay the flat fee
          only. You&apos;ll see &ldquo;location not shared&rdquo; on those orders.
        </p>
      </section>

      {/* Delivery + business info */}
      <section className="rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
        <h2 className="font-display text-xl text-coffee">Delivery &amp; business info</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className={labelCls}>Minimum order (₹)</span>
            <input
              className={field}
              inputMode="decimal"
              value={form.min_order_amount}
              onFocus={(e) => e.target.select()}
              onChange={(e) => set("min_order_amount", cleanNum(e.target.value))}
            />
          </div>
          <div>
            <span className={labelCls}>Delivery fee (₹)</span>
            <input
              className={field}
              inputMode="decimal"
              value={form.delivery_fee}
              onFocus={(e) => e.target.select()}
              onChange={(e) => set("delivery_fee", cleanNum(e.target.value))}
            />
          </div>
          <div>
            <span className={labelCls}>Delivery radius (km)</span>
            <input
              className={field}
              inputMode="decimal"
              value={form.delivery_radius_km}
              onFocus={(e) => e.target.select()}
              onChange={(e) => set("delivery_radius_km", cleanNum(e.target.value))}
            />
          </div>
          <div>
            <span className={labelCls}>FSSAI licence no.</span>
            <input className={field} value={form.fssai_license} onChange={(e) => set("fssai_license", e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Open time</span>
            <input type="time" className={field} value={form.open_time} onChange={(e) => set("open_time", e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Close time</span>
            <input type="time" className={field} value={form.close_time} onChange={(e) => set("close_time", e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Phone</span>
            <input className={field} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>WhatsApp number</span>
            <input className={field} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Email</span>
            <input className={field} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <span className={labelCls}>Kitchen address</span>
            <input className={field} value={form.kitchen_address} onChange={(e) => set("kitchen_address", e.target.value)} />
          </div>
        </div>

      </section>

      {/* One button saves this whole page, so it stays in reach wherever you
          are on it — not buried at the bottom of one section. */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-4 rounded-2xl border border-gold/40 bg-white/95 px-5 py-4 shadow-warm backdrop-blur">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-white shadow-warm hover:bg-gold-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {!pending && dirty && (
          <span className="text-sm font-medium text-amber-800">
            You have unsaved changes on this page.
          </span>
        )}
        {!pending && !dirty && !msg && <span className="text-sm text-brown/50">All changes saved.</span>}
        {msg && <span className="text-sm text-brown/70">{msg}</span>}
      </div>
    </div>
  );
}
