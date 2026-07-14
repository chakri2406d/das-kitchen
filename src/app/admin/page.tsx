import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatINR, ORDER_STATUS_LABEL } from "@/lib/utils";

export const dynamic = "force-dynamic";

type RecentOrder = {
  id: string;
  order_number: string | null;
  status: string;
  total: number;
  placed_at: string;
  order_items: { item_name: string; quantity: number }[];
};

export default async function AdminDashboard() {
  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: pending }, { count: active }, { data: todays }, { data: recentRows }] =
    await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "out_for_delivery"),
      supabase.from("orders").select("total, status").gte("placed_at", todayStart.toISOString()),
      supabase
        .from("orders")
        .select("id, order_number, status, total, placed_at, order_items(item_name, quantity)")
        .order("placed_at", { ascending: false })
        .limit(8),
    ]);

  // Revenue counts only orders that weren't cancelled.
  const paidToday = (todays ?? []).filter((o) => o.status !== "cancelled");
  const revenueToday = paidToday.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const recent = (recentRows ?? []) as unknown as RecentOrder[];

  const cards = [
    { label: "Orders today", value: todays?.length ?? 0 },
    { label: "Revenue today", value: formatINR(revenueToday) },
    { label: "Pending orders", value: pending ?? 0 },
    { label: "Active deliveries", value: active ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl text-coffee">Dashboard</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
            <p className="text-sm text-brown/60">{c.label}</p>
            <p className="mt-2 font-display text-3xl text-coffee">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="font-display text-2xl text-coffee">Recent orders</h2>
        <Link href="/admin/orders" className="text-sm font-semibold text-gold-dark hover:underline">
          Manage orders →
        </Link>
      </div>

      {recent.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-brown/20 p-8 text-center text-brown/60">
          No orders yet.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-brown/10 rounded-2xl border border-brown/10 bg-soft">
          {recent.map((o) => {
            const summary = (o.order_items ?? []).map((i) => `${i.item_name} ×${i.quantity}`).join(", ");
            return (
              <Link
                key={o.id}
                href="/admin/orders"
                className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-cream/60"
              >
                <div className="min-w-0">
                  <p className="font-medium text-coffee">#{o.order_number ?? o.id.slice(0, 8)}</p>
                  <p className="truncate text-sm text-brown/60">{summary || "—"}</p>
                  <p className="text-xs text-brown/45">{new Date(o.placed_at).toLocaleString("en-IN")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-coffee">
                    {ORDER_STATUS_LABEL[o.status] ?? o.status}
                  </span>
                  <span className="font-semibold text-coffee">{formatINR(Number(o.total))}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
