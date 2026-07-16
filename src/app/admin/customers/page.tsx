import { createClient } from "@/lib/supabase/server";
import { fetchCustomerReport } from "@/lib/reports";
import {
  formatINR,
  formatDateTime,
  istDateStr,
  istDateStrOffset,
  istDateStartISO,
  istDateEndExclusiveISO,
} from "@/lib/utils";
import { DateRange } from "./date-range";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  // Default to the last 30 days — enough to be useful on first open.
  const from = DATE_RE.test(sp.from ?? "") ? sp.from! : istDateStrOffset(-29);
  const to = DATE_RE.test(sp.to ?? "") ? sp.to! : istDateStr();

  const supabase = await createClient();
  const { orders, customers } = await fetchCustomerReport(
    supabase,
    istDateStartISO(from),
    istDateEndExclusiveISO(to)
  );

  const revenue = customers.reduce((s, c) => s + c.totalSpent, 0);
  const cash = customers.reduce((s, c) => s + c.cashSpent, 0);
  const online = customers.reduce((s, c) => s + c.onlineSpent, 0);
  const repeat = customers.filter((c) => c.orders > 1).length;

  const cards = [
    { label: "Customers", value: String(customers.length) },
    { label: "Orders", value: String(orders.length) },
    { label: "Revenue", value: formatINR(revenue) },
    { label: "Repeat customers", value: String(repeat) },
    { label: "Collected cash", value: formatINR(cash) },
    { label: "Collected online", value: formatINR(online) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-coffee">Customers</h1>
      <p className="mt-2 text-brown/70">
        Everyone who ordered between two dates, what they spent, and how they paid. Download it as
        Excel for your records.
      </p>

      <div className="mt-6">
        <DateRange from={from} to={to} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-brown/10 bg-soft p-4 shadow-card">
            <p className="text-xs text-brown/60">{c.label}</p>
            <p className="mt-1 font-display text-xl text-coffee">{c.value}</p>
          </div>
        ))}
      </div>

      {customers.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-brown/20 p-10 text-center text-brown/60">
          No orders between {from} and {to}. Try a wider range.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-brown/10 bg-soft shadow-card">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-brown/10 text-xs uppercase tracking-wide text-brown/50">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 text-right font-semibold">Orders</th>
                <th className="px-4 py-3 text-right font-semibold">Spent</th>
                <th className="px-4 py-3 text-right font-semibold">Avg</th>
                <th className="px-4 py-3 text-right font-semibold">Cash</th>
                <th className="px-4 py-3 text-right font-semibold">Online</th>
                <th className="px-4 py-3 font-semibold">Last order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brown/10">
              {customers.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-cream/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-coffee">{c.name}</p>
                    {c.orders > 1 && (
                      <span className="mt-0.5 inline-block rounded-full bg-gold-soft/60 px-2 py-0.5 text-[10px] font-semibold text-coffee">
                        Repeat
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-brown/70">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="font-medium text-gold-dark hover:underline">
                        {c.phone}
                      </a>
                    )}
                    {c.email && <p className="truncate text-xs text-brown/50">{c.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-coffee">
                    {c.orders}
                    {c.cancelled > 0 && (
                      <span className="ml-1 text-xs text-red-600">({c.cancelled} cxl)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-coffee">{formatINR(c.totalSpent)}</td>
                  <td className="px-4 py-3 text-right text-brown/70">{formatINR(c.avgOrder)}</td>
                  <td className="px-4 py-3 text-right text-brown/70">{formatINR(c.cashSpent)}</td>
                  <td className="px-4 py-3 text-right text-brown/70">{formatINR(c.onlineSpent)}</td>
                  <td className="px-4 py-3 text-xs text-brown/50">{formatDateTime(c.lastOrder)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
