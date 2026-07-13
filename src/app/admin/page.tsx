import { Logo } from "@/components/brand/logo";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { formatINR, ORDER_STATUS_LABEL } from "@/lib/utils";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type AdminOrderItem = { item_name: string; quantity: number };
type AdminOrder = {
  id: string;
  order_number: string | null;
  status: string;
  total: number;
  payment_method: string;
  placed_at: string;
  customer_lat: number | null;
  customer_lng: number | null;
  delivery_address: Record<string, string> | null;
  order_items: AdminOrderItem[];
};

export default async function AdminDashboard() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/");

  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: pending }, { count: active }, { data: todays }, { data: orderRows }] =
    await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "out_for_delivery"),
      supabase.from("orders").select("total").gte("placed_at", todayStart.toISOString()),
      supabase
        .from("orders")
        .select("id, order_number, status, total, payment_method, placed_at, customer_lat, customer_lng, delivery_address, order_items(item_name, quantity)")
        .order("placed_at", { ascending: false })
        .limit(50),
    ]);

  const revenueToday = (todays ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0);
  const orders = (orderRows ?? []) as unknown as AdminOrder[];

  const cards = [
    { label: "Orders today", value: todays?.length ?? 0 },
    { label: "Revenue today", value: formatINR(revenueToday) },
    { label: "Pending orders", value: pending ?? 0 },
    { label: "Active deliveries", value: active ?? 0 },
  ];

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-brown/10 bg-soft">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo withWordmark />
          <span className="rounded-full bg-coffee px-3 py-1 text-xs font-semibold text-cream">Admin</span>
        </div>
      </header>
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

        <h2 className="mt-10 font-display text-2xl text-coffee">Incoming orders</h2>
        {orders.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-brown/20 p-8 text-center text-brown/60">
            No orders yet.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {orders.map((o) => {
              const addr = o.delivery_address ?? {};
              const hasPin = o.customer_lat != null && o.customer_lng != null;
              const mapUrl = hasPin
                ? `https://www.google.com/maps/search/?api=1&query=${o.customer_lat},${o.customer_lng}`
                : null;
              return (
                <article key={o.id} className="rounded-2xl border border-brown/10 bg-soft p-5 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-display text-lg text-coffee">
                        #{o.order_number ?? o.id.slice(0, 8)}
                        <span className="ml-3 text-sm font-normal text-brown/50">
                          {new Date(o.placed_at).toLocaleString("en-IN")}
                        </span>
                      </p>
                      <p className="text-sm text-brown/70">
                        {addr.full_name ?? "Customer"} · {addr.phone ?? "no phone"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-coffee">
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      <p className="mt-1 font-semibold text-coffee">{formatINR(Number(o.total))}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-brown/80">
                    {(o.order_items ?? []).map((i) => `${i.item_name} ×${i.quantity}`).join(", ")}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-brown/10 pt-3 text-sm text-brown/70">
                    <span>
                      {[addr.house_number, addr.street, addr.area, addr.city, addr.pincode]
                        .filter(Boolean)
                        .join(", ") || "No address"}
                    </span>
                    <span className="text-xs uppercase text-brown/50">
                      {o.payment_method === "cod" ? "COD" : o.payment_method}
                    </span>
                    {mapUrl && (
                      <a
                        href={mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-gold-dark hover:underline"
                      >
                        Open location ↗
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
