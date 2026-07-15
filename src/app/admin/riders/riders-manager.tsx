"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { makeDeliveryPartner, removeDeliveryPartner, setRiderVerified } from "./actions";

export type RiderRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  vehicle_type: string | null;
  vehicle_number: string | null;
  status: string | null;
  is_verified: boolean;
  total_deliveries: number;
};

const STATUS_PILL: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  busy: "bg-amber-100 text-amber-900",
  offline: "bg-brown/10 text-brown/70",
};

export function RidersManager({ riders }: { riders: RiderRow[] }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setErr(res.error ?? "Something went wrong.");
      else if (res.message) setMsg(res.message);
    });
  }

  function add() {
    if (!email.trim()) return;
    const value = email;
    run(async () => {
      const res = await makeDeliveryPartner(value);
      if (res.ok) setEmail("");
      return res;
    });
  }

  const field =
    "w-full rounded-xl border border-brown/20 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold";

  return (
    <div className="space-y-8">
      {/* Add rider */}
      <section className="rounded-2xl border border-gold/40 bg-white p-6 shadow-warm">
        <h2 className="font-display text-xl text-coffee">Add a delivery partner</h2>
        <p className="mt-1 text-sm text-brown/70">
          They must sign up on the site first with this email — then enter it here to turn their
          account into a delivery partner.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !pending && add()}
            placeholder="rider@gmail.com"
            className={cn(field, "max-w-sm flex-1")}
          />
          <button
            onClick={add}
            disabled={pending}
            className="rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-white shadow-warm hover:bg-gold-dark disabled:opacity-60"
          >
            {pending ? "Adding…" : "Make delivery partner"}
          </button>
        </div>
        {msg && <p className="mt-3 text-sm font-medium text-green-700">{msg}</p>}
        {err && <p className="mt-3 text-sm font-medium text-red-600">{err}</p>}
      </section>

      {/* List */}
      <section>
        <h2 className="font-display text-xl text-coffee">Delivery partners ({riders.length})</h2>
        {riders.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-brown/20 p-8 text-center text-brown/60">
            No delivery partners yet. Add one above and they&apos;ll appear in the &ldquo;Assign rider&rdquo; list on orders.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {riders.map((r) => (
              <article
                key={r.id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-brown/10 bg-soft p-4 shadow-card"
              >
                <div className="min-w-[10rem] flex-1">
                  <p className="font-medium text-coffee">{r.full_name ?? "Unnamed rider"}</p>
                  <p className="text-sm text-brown/60">{r.email}</p>
                  <p className="text-xs text-brown/45">
                    {r.phone ? `${r.phone} · ` : ""}
                    {r.vehicle_type ?? "bike"}
                    {r.vehicle_number ? ` (${r.vehicle_number})` : ""} · {r.total_deliveries} deliveries
                  </p>
                </div>

                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    STATUS_PILL[r.status ?? "offline"] ?? STATUS_PILL.offline
                  )}
                >
                  {r.status ?? "offline"}
                </span>

                <button
                  onClick={() => run(() => setRiderVerified(r.id, !r.is_verified))}
                  disabled={pending}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
                    r.is_verified
                      ? "bg-green-100 text-green-800 hover:bg-green-200"
                      : "bg-cream text-brown hover:bg-brown/10"
                  )}
                >
                  {r.is_verified ? "Verified" : "Not verified"}
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Remove ${r.full_name ?? r.email} from delivery partners?`)) {
                      run(() => removeDeliveryPartner(r.id));
                    }
                  }}
                  disabled={pending}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Remove
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
