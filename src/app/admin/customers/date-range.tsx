"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { istDateStr, istDateStrOffset } from "@/lib/utils";

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 6 },
  { label: "30 days", days: 29 },
  { label: "90 days", days: 89 },
];

/** From/To pickers + quick presets + the Excel download. */
export function DateRange({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  function apply(nf = f, nt = t) {
    router.push(`/admin/customers?from=${nf}&to=${nt}`);
  }

  function preset(days: number) {
    const nf = istDateStrOffset(-days);
    const nt = istDateStr();
    setF(nf);
    setT(nt);
    apply(nf, nt);
  }

  const field = "rounded-xl border border-brown/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold";
  const invalid = f > t;

  return (
    <div className="rounded-2xl border border-brown/10 bg-soft p-5 shadow-card">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-brown/60">From date</label>
          <input type="date" value={f} max={t} onChange={(e) => setF(e.target.value)} className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-brown/60">To date</label>
          <input type="date" value={t} min={f} max={istDateStr()} onChange={(e) => setT(e.target.value)} className={field} />
        </div>

        <button
          onClick={() => apply()}
          disabled={invalid}
          className="rounded-full bg-coffee px-5 py-2 text-sm font-medium text-cream hover:bg-brown disabled:opacity-50"
        >
          Apply
        </button>

        {/* A plain link: the server builds the file and the browser downloads it. */}
        <a
          href={`/admin/customers/export?from=${from}&to=${to}`}
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-warm hover:bg-green-700"
        >
          <Download size={16} /> Download Excel
        </a>
      </div>

      {invalid && <p className="mt-2 text-xs text-red-600">&ldquo;From&rdquo; must be on or before &ldquo;To&rdquo;.</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => preset(p.days)}
            className="rounded-full bg-brown/5 px-3 py-1 text-xs font-medium text-brown hover:bg-brown/10"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
