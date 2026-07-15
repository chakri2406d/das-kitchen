import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { formatINR } from "@/lib/utils";
import { DeliveryOrderCard, type RiderOrder } from "./delivery-order-card";

export const dynamic = "force-dynamic";

const ACTIVE = ["accepted", "preparing", "ready_for_pickup", "out_for_delivery"];

export default async function DeliveryDashboard() {
  const profile = await getCurrentProfile();
  if (!profile) return null; // layout already guards the role

  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const columns =
    "id, order_number, status, total, payment_method, payment_status, placed_at, customer_lat, customer_lng, delivery_notes, delivery_address, order_items(item_name, quantity)";

  const [{ data: activeRows }, { data: doneToday }] = await Promise.all([
    supabase
      .from("orders")
      .select(columns)
      .eq("delivery_partner_id", profile.id)
      .in("status", ACTIVE)
      .order("placed_at", { ascending: true }),
    supabase
      .from("orders")
      .select("total")
      .eq("delivery_partner_id", profile.id)
      .eq("status", "delivered")
      .gte("delivered_at", todayStart.toISOString()),
  ]);

  const orders = (activeRows ?? []) as unknown as RiderOrder[];
  const deliveredToday = doneToday?.length ?? 0;
  const collectedToday = (doneToday ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0);

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
          <p className="mt-1 font-display text-2xl text-coffee">{deliveredToday}</p>
        </div>
        <div className="rounded-2xl border border-brown/10 bg-soft p-4 text-center shadow-card">
          <p className="text-xs text-brown/60">Collected today</p>
          <p className="mt-1 font-display text-2xl text-coffee">{formatINR(collectedToday)}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brown/20 p-10 text-center text-brown/60">
            No deliveries assigned right now. New ones appear here once the kitchen assigns you an order.
          </p>
        ) : (
          orders.map((o) => <DeliveryOrderCard key={o.id} order={o} />)
        )}
      </div>
    </div>
  );
}
