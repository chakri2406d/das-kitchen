"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
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

export function SettingsForm({ settings }: { settings: BusinessSettings }) {
  const [status, setStatus] = useState<BusinessStatus>(settings.status);
  const [form, setForm] = useState({
    is_accepting_orders: settings.is_accepting_orders,
    min_order_amount: String(settings.min_order_amount ?? 0),
    delivery_fee: String(settings.delivery_fee ?? 0),
    delivery_radius_km: String(settings.delivery_radius_km ?? 0),
    kitchen_address: settings.kitchen_address ?? "",
    phone: settings.phone ?? "",
    whatsapp: settings.whatsapp ?? "",
    email: settings.email ?? "",
    fssai_license: settings.fssai_license ?? "",
    open_time: settings.open_time ?? "",
    close_time: settings.close_time ?? "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
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
        min_order_amount: num(form.min_order_amount),
        delivery_fee: num(form.delivery_fee),
        delivery_radius_km: num(form.delivery_radius_km),
        kitchen_address: form.kitchen_address,
        phone: form.phone,
        whatsapp: form.whatsapp,
        email: form.email,
        fssai_license: form.fssai_license,
        open_time: form.open_time,
        close_time: form.close_time,
      });
      setMsg(res.ok ? "Settings saved." : res.error);
    });
  }

  const field = "w-full rounded-xl border border-brown/20 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold";
  const labelCls = "text-sm font-medium text-brown";

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

      {/* Delivery + business info */}
      <section className="rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
        <h2 className="font-display text-xl text-coffee">Delivery &amp; business info</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className={labelCls}>Minimum order (₹)</span>
            <input className={field} inputMode="decimal" value={form.min_order_amount} onChange={(e) => set("min_order_amount", e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Delivery fee (₹)</span>
            <input className={field} inputMode="decimal" value={form.delivery_fee} onChange={(e) => set("delivery_fee", e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Delivery radius (km)</span>
            <input className={field} inputMode="decimal" value={form.delivery_radius_km} onChange={(e) => set("delivery_radius_km", e.target.value)} />
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

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={save}
            disabled={pending}
            className="rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-white shadow-warm hover:bg-gold-dark disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save settings"}
          </button>
          {msg && <span className="text-sm text-brown/70">{msg}</span>}
        </div>
      </section>
    </div>
  );
}
