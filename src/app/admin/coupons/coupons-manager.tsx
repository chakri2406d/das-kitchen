"use client";

import { useState, useTransition } from "react";
import { formatINR, cn } from "@/lib/utils";
import type { Coupon, CouponType } from "@/types/database";
import { createCoupon, toggleCoupon, deleteCoupon } from "./actions";

export function CouponsManager({ coupons }: { coupons: Coupon[] }) {
  const [form, setForm] = useState({
    code: "",
    coupon_type: "percentage" as CouponType,
    discount_value: "",
    min_order_amount: "0",
    max_discount: "",
    expiry_date: "",
    usage_limit: "",
    once_per_customer: true,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setMsg(res.error ?? "Something went wrong.");
      else if (okMsg) setMsg(okMsg);
    });
  }

  function create() {
    run(
      () =>
        createCoupon({
          code: form.code,
          coupon_type: form.coupon_type,
          discount_value: Number(form.discount_value) || 0,
          min_order_amount: Number(form.min_order_amount) || 0,
          max_discount: form.max_discount ? Number(form.max_discount) : null,
          expiry_date: form.expiry_date ? new Date(form.expiry_date).toISOString() : null,
          usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
          once_per_customer: form.once_per_customer,
        }),
      "Coupon created."
    );
    setForm((f) => ({ ...f, code: "", discount_value: "", max_discount: "", expiry_date: "", usage_limit: "" }));
  }

  const field = "w-full rounded-xl border border-brown/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold";

  return (
    <div className="space-y-8">
      {msg && <p className="rounded-xl border border-brown/15 bg-soft px-4 py-2.5 text-sm text-brown/80">{msg}</p>}

      <section className="rounded-2xl border border-gold/40 bg-white p-6 shadow-warm">
        <h2 className="font-display text-xl text-coffee">New coupon</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-brown">Code</label>
            <input className={cn(field, "uppercase")} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="WELCOME50" />
          </div>
          <div>
            <label className="text-sm font-medium text-brown">Type</label>
            <select className={field} value={form.coupon_type} onChange={(e) => set("coupon_type", e.target.value as CouponType)}>
              <option value="percentage">Percentage (%)</option>
              <option value="flat">Flat (₹)</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-brown">{form.coupon_type === "percentage" ? "Discount %" : "Discount ₹"}</label>
            <input className={field} inputMode="decimal" value={form.discount_value} onChange={(e) => set("discount_value", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-brown">Min order (₹)</label>
            <input className={field} inputMode="decimal" value={form.min_order_amount} onChange={(e) => set("min_order_amount", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-brown">Max discount (₹, optional)</label>
            <input className={field} inputMode="decimal" value={form.max_discount} onChange={(e) => set("max_discount", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-brown">Usage limit (optional)</label>
            <input className={field} inputMode="numeric" value={form.usage_limit} onChange={(e) => set("usage_limit", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-brown">Expiry (optional)</label>
            <input type="date" className={field} value={form.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} />
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-brown">
          <input
            type="checkbox"
            checked={form.once_per_customer}
            onChange={(e) => set("once_per_customer", e.target.checked)}
            className="h-4 w-4 accent-gold"
          />
          One use per customer
          <span className="text-xs text-brown/50">(uncheck for codes anyone can reuse, e.g. free delivery)</span>
        </label>

        <button
          onClick={create}
          disabled={pending}
          className="mt-5 rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Create coupon"}
        </button>
      </section>

      <section>
        <h2 className="font-display text-xl text-coffee">All coupons ({coupons.length})</h2>
        {coupons.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-brown/20 p-8 text-center text-brown/60">No coupons yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {coupons.map((c) => {
              const expired = c.expiry_date != null && new Date(c.expiry_date) < new Date();
              return (
                <article key={c.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-brown/10 bg-soft p-4 shadow-card">
                  <div className="min-w-[7rem] flex-1">
                    <p className="font-mono font-semibold text-coffee">{c.code}</p>
                    <p className="text-sm text-brown/60">
                      {c.coupon_type === "percentage" ? `${c.discount_value}% off` : `${formatINR(c.discount_value)} off`}
                      {c.min_order_amount ? ` · min ${formatINR(c.min_order_amount)}` : ""}
                      {c.max_discount ? ` · cap ${formatINR(c.max_discount)}` : ""}
                    </p>
                    <p className="text-xs text-brown/45">
                      {c.once_per_customer ? "1 per customer · " : "Reusable · "}
                      Used {c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ""}
                      {c.expiry_date ? ` · expires ${new Date(c.expiry_date).toLocaleDateString("en-IN")}` : ""}
                      {expired ? " · EXPIRED" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => run(() => toggleCoupon(c.id, !c.is_active))}
                    disabled={pending}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
                      c.is_active ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-cream text-brown hover:bg-brown/10"
                    )}
                  >
                    {c.is_active ? "Active" : "Inactive"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete coupon ${c.code}?`)) run(() => deleteCoupon(c.id), "Deleted.");
                    }}
                    disabled={pending}
                    className="rounded-full px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
