import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { distanceKm } from "@/lib/geo";
import { OrderCard, type AdminOrder, type Rider } from "./order-card";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["pending", "accepted", "preparing", "ready_for_pickup", "out_for_delivery"];
const PAST_PER_PAGE = 20;

const COLUMNS =
  "id, order_number, status, total, payment_method, payment_status, placed_at, delivery_partner_id, customer_lat, customer_lng, delivery_fee, delivery_otp, delivery_notes, delivery_address, order_items(item_name, quantity)";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAST_PER_PAGE;

  const supabase = await createClient();

  const [
    { data: activeRows },
    { data: pastRows, count: pastCount },
    { data: riderRows },
    { data: settings },
  ] = await Promise.all([
    // Active orders are what you're working on — always show all of them.
    supabase
      .from("orders")
      .select(COLUMNS)
      .in("status", ACTIVE_STATUSES)
      .order("placed_at", { ascending: false }),
    // Finished orders are history — fetch one page at a time so this page stays
    // fast whether you have 50 orders or 50,000.
    supabase
      .from("orders")
      .select(COLUMNS, { count: "exact" })
      .in("status", ["delivered", "cancelled"])
      .order("placed_at", { ascending: false })
      .range(offset, offset + PAST_PER_PAGE - 1),
    supabase.from("profiles").select("id, full_name, phone").eq("role", "delivery_partner"),
    supabase
      .from("business_settings")
      .select("kitchen_lat, kitchen_lng, delivery_radius_km")
      .eq("id", 1)
      .single(),
  ]);

  const active = (activeRows ?? []) as unknown as AdminOrder[];
  const past = (pastRows ?? []) as unknown as AdminOrder[];
  const riders = (riderRows ?? []) as Rider[];

  const totalPast = pastCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalPast / PAST_PER_PAGE));

  const radius = Number(settings?.delivery_radius_km ?? 0) || null;
  const kLat = settings?.kitchen_lat ?? null;
  const kLng = settings?.kitchen_lng ?? null;
  const distanceFor = (o: AdminOrder): number | null =>
    kLat != null && kLng != null && o.customer_lat != null && o.customer_lng != null
      ? distanceKm(kLat, kLng, o.customer_lat, o.customer_lng)
      : null;

  const cardProps = (o: AdminOrder) => ({
    order: o,
    riders,
    distanceKm: distanceFor(o),
    radiusKm: radius,
    kitchenLat: kLat,
    kitchenLng: kLng,
  });

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
            <OrderCard key={o.id} {...cardProps(o)} />
          ))}
        </div>
      )}

      {totalPast > 0 && (
        <>
          <h2 className="mt-10 font-display text-xl text-coffee">
            Completed &amp; cancelled ({totalPast})
            <span className="ml-2 text-sm font-normal text-brown/50">
              page {page} of {totalPages}
            </span>
          </h2>

          <div className="mt-4 space-y-4 opacity-80">
            {past.map((o) => (
              <OrderCard key={o.id} {...cardProps(o)} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between gap-3">
              {page > 1 ? (
                <Link
                  href={`/admin/orders?page=${page - 1}`}
                  className="rounded-full border border-brown/25 px-5 py-2 text-sm font-medium text-brown hover:bg-brown/5"
                >
                  ← Newer
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-brown/50">
                Showing {offset + 1}–{Math.min(offset + PAST_PER_PAGE, totalPast)} of {totalPast}
              </span>
              {page < totalPages ? (
                <Link
                  href={`/admin/orders?page=${page + 1}`}
                  className="rounded-full border border-brown/25 px-5 py-2 text-sm font-medium text-brown hover:bg-brown/5"
                >
                  Older →
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
