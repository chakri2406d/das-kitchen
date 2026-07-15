import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { formatINR, formatTime, istDayStartISO } from "@/lib/utils";
import { DeliveryOrderCard, type RiderOrder } from "./delivery-order-card";
import { RiderPing } from "./rider-ping";

export const dynamic = "force-dynamic";

const ACTIVE = ["accepted", "preparing", "ready_for_pickup", "out_for_delivery"];

type DoneOrder = {
  id: string;
  order_number: string | null;
  total: number;
  delivered_at: string | null;
};

export default async function DeliveryDashboard() {
  const profile = await getCurrentProfile();
  if (!profile) return null; // layout already guards the role

  const supabase = await createClient();
  const todayStart = istDayStartISO(); // "today" in India, not on the server

  const columns =
    "id, order_number, status, total, payment_method, payment_status, placed_at, customer_lat, customer_lng, delivery_notes, delivery_address, order_items(item_name, quantity)";

  const [{ data: activeRows }, { data: doneRows }] = await Promise.all([
    supabase
      .from("orders")
      .select(columns)
      .eq("delivery_partner_id", profile.id)
      .in("status", ACTIVE)
      .order("placed_at", { ascending: true }),
    supabase
      .from("orders")
      .select("id, order_number, total, delivered_at")
      .eq("delivery_partner_id", profile.id)
      .eq("status", "delivered")
      .gte("delivered_at", todayStart)
      .order("delivered_at", { ascending: false }),
  ]);

  const orders = (activeRows ?? []) as unknown as RiderOrder[];
  const done = (doneRows ?? []) as DoneOrder[];
  const collectedToday = done.reduce((s, o) => s + Number(o.total ?? 0), 0);

  // Ping GPS for whichever order is currently out for delivery.
  const outForDelivery = orders.find((o) => o.status === "out_for_delivery");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl text-coffee">Your Deliveries</h1>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-brown/10 bg-soft p-4 text-center shadow-card">
          <p className="text-xs text-brown/60">Active</p>
          <p className="mt-1 font-display text-2xl text-coffee">{orders.length}</p>
        </div>
        <div className="rounded-2xl border border-brown/10 bg-soft p-4 text-center shadow-card">
          <p className="text-xs text-brown/60">Delivered today</p>
          <p className="mt-1 font-display text-2xl text-coffee">{done.length}</p>
        </div>
        <div className="rounded-2xl border border-brown/10 bg-soft p-4 text-center shadow-card">
          <p className="text-xs text-brown/60">Collected today</p>
          <p className="mt-1 font-display text-2xl text-coffee">{formatINR(collectedToday)}</p>
        </div>
      </div>

      <RiderPing orderId={outForDelivery?.id ?? null} riderId={profile.id} />

      <div className="mt-6 space-y-4">
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brown/20 p-10 text-center text-brown/60">
            No deliveries assigned right now. New ones appear here once the kitchen assigns you an order.
          </p>
        ) : (
          orders.map((o) => <DeliveryOrderCard key={o.id} order={o} />)
        )}
      </div>

      {done.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl text-coffee">Delivered today ({done.length})</h2>
          <div className="mt-3 divide-y divide-brown/10 rounded-2xl border border-brown/10 bg-soft">
            {done.map((o) => (
              <div key={o.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="font-medium text-coffee">#{o.order_number ?? o.id.slice(0, 8)}</p>
                  <p className="text-xs text-brown/50">
                    {o.delivered_at ? `Delivered ${formatTime(o.delivered_at)}` : "Delivered"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                    Delivered
                  </span>
                  <span className="font-semibold text-coffee">{formatINR(Number(o.total))}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
