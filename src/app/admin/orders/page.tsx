import { createClient } from "@/lib/supabase/server";
import { distanceKm } from "@/lib/geo";
import { OrderCard, type AdminOrder, type Rider } from "./order-card";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const supabase = await createClient();

  const [{ data: orderRows }, { data: riderRows }, { data: settings }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, status, total, payment_method, payment_status, placed_at, delivery_partner_id, customer_lat, customer_lng, delivery_otp, delivery_notes, delivery_address, order_items(item_name, quantity)"
      )
      .order("placed_at", { ascending: false })
      .limit(100),
    supabase.from("profiles").select("id, full_name, phone").eq("role", "delivery_partner"),
    supabase
      .from("business_settings")
      .select("kitchen_lat, kitchen_lng, delivery_radius_km")
      .eq("id", 1)
      .single(),
  ]);

  const orders = (orderRows ?? []) as unknown as AdminOrder[];
  const riders = (riderRows ?? []) as Rider[];

  // How far is each customer from the kitchen? (only possible once the kitchen
  // location is set in Settings and the customer shared their location)
  const radius = Number(settings?.delivery_radius_km ?? 0) || null;
  const kLat = settings?.kitchen_lat ?? null;
  const kLng = settings?.kitchen_lng ?? null;
  const distanceFor = (o: AdminOrder): number | null =>
    kLat != null && kLng != null && o.customer_lat != null && o.customer_lng != null
      ? distanceKm(kLat, kLng, o.customer_lat, o.customer_lng)
      : null;

  // Active orders first, finished ones last.
  const finished = new Set(["delivered", "cancelled"]);
  const active = orders.filter((o) => !finished.has(o.status));
  const past = orders.filter((o) => finished.has(o.status));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-coffee">Orders</h1>
      <p className="mt-2 text-brown/70">Accept, prepare, assign a rider, and move each order through delivery.</p>

      {kLat == null && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Set your <strong>kitchen location</strong> in Settings to see how far each customer is.
        </p>
      )}

      <h2 className="mt-8 font-display text-xl text-coffee">Active ({active.length})</h2>
      {active.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-brown/20 p-8 text-center text-brown/60">
          No active orders right now.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {active.map((o) => (
            <OrderCard key={o.id} order={o} riders={riders} distanceKm={distanceFor(o)} radiusKm={radius} kitchenLat={kLat} kitchenLng={kLng} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-xl text-coffee">Completed &amp; cancelled ({past.length})</h2>
          <div className="mt-4 space-y-4 opacity-80">
            {past.map((o) => (
              <OrderCard key={o.id} order={o} riders={riders} distanceKm={distanceFor(o)} radiusKm={radius} kitchenLat={kLat} kitchenLng={kLng} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
