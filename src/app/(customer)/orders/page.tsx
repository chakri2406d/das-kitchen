import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { OrderTracker } from "@/components/orders/order-tracker";
import { PlacedCelebration } from "@/components/orders/placed-celebration";
import { createClient } from "@/lib/supabase/server";
import { formatINR, ORDER_STATUS_LABEL, formatDateTime } from "@/lib/utils";
import { UpiQr } from "@/components/payments/upi-qr";
import { ReorderButton } from "@/components/orders/reorder-button";

export const dynamic = "force-dynamic";

type OrderItem = { item_name: string; quantity: number };
type RiderProfile = { full_name: string | null; phone: string | null } | null;
type OrderRow = {
  id: string;
  order_number: string | null;
  status: string;
  total: number;
  payment_method: string;
  placed_at: string;
  delivery_otp: string | null;
  payment_status: string;
  customer_lat: number | null;
  customer_lng: number | null;
  delivery_partner_id: string | null;
  order_items: OrderItem[];
};

const FINISHED = new Set(["delivered", "cancelled"]);

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ placed?: string }>;
}) {
  const { placed } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: settings } = await supabase
    .from("business_settings")
    .select("upi_id, upi_name")
    .eq("id", 1)
    .single();
  const upiId = settings?.upi_id ?? null;
  const upiName = settings?.upi_name ?? "Das Kitchen";

  const { data } = user
    ? await supabase
        .from("orders")
        .select(
          "id, order_number, status, total, payment_method, payment_status, placed_at, delivery_otp, customer_lat, customer_lng, delivery_partner_id, order_items(item_name, quantity)"
        )
        .eq("customer_id", user.id)
        .order("placed_at", { ascending: false })
    : { data: [] };

  const orders = (data ?? []) as unknown as OrderRow[];

  // Fetch rider details for any live order that has one assigned.
  const riderIds = [...new Set(orders.filter((o) => !FINISHED.has(o.status) && o.delivery_partner_id).map((o) => o.delivery_partner_id!))];
  const riderMap = new Map<string, RiderProfile>();
  if (riderIds.length > 0) {
    const { data: riders } = await supabase.from("profiles").select("id, full_name, phone").in("id", riderIds);
    (riders ?? []).forEach((r) => riderMap.set(r.id, { full_name: r.full_name, phone: r.phone }));
  }

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      {placed && <PlacedCelebration orderNumber={placed} />}
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl text-coffee">My Orders</h1>

        {orders.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-brown/20 p-10 text-center">
            <p className="text-brown/70">You haven&apos;t placed any orders yet.</p>
            <Link
              href="/menu"
              className="mt-4 inline-block rounded-full bg-gold px-6 py-2 text-sm font-medium text-white hover:bg-gold-dark"
            >
              Order something
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {orders.map((o) => {
              const live = !FINISHED.has(o.status);
              const arriving = o.status === "out_for_delivery";
              return (
                <article key={o.id} className="rounded-2xl border border-brown/10 bg-soft p-5 shadow-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display text-lg text-coffee">#{o.order_number ?? o.id.slice(0, 8)}</p>
                      <p className="text-xs text-brown/50">{formatDateTime(o.placed_at)}</p>
                    </div>
                    <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-coffee">
                      {ORDER_STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-brown/70">
                    {(o.order_items ?? []).map((i) => `${i.item_name} ×${i.quantity}`).join(", ")}
                  </p>

                  {live && (
                    <OrderTracker
                      orderId={o.id}
                      initialStatus={o.status}
                      customerLat={o.customer_lat}
                      customerLng={o.customer_lng}
                      rider={o.delivery_partner_id ? riderMap.get(o.delivery_partner_id) ?? null : null}
                    />
                  )}

                  {/* Still owe money? Offer the QR right here. */}
                  {live && upiId && o.payment_status !== "paid" && (
                    <div className="mt-4 rounded-xl border border-brown/10 bg-white p-4">
                      <p className="text-center text-xs font-semibold uppercase tracking-wide text-brown/50">
                        Pay online (optional)
                      </p>
                      <div className="mt-3">
                        <UpiQr
                          upiId={upiId}
                          payeeName={upiName}
                          amount={Number(o.total)}
                          note={`Das Kitchen ${o.order_number ?? ""}`.trim()}
                          size={150}
                          compact
                        />
                      </div>
                      <p className="mt-3 text-center text-xs text-brown/60">
                        Or just pay cash when it arrives.
                      </p>
                    </div>
                  )}

                  {/* Delivery OTP — read this to the rider on handover. */}
                  {live && o.delivery_otp && (
                    <div
                      className={
                        arriving
                          ? "mt-3 rounded-xl border border-gold/50 bg-gold-soft/30 p-4"
                          : "mt-3 rounded-xl border border-brown/10 bg-white p-4"
                      }
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-brown/60">Delivery OTP</p>
                      <p className="mt-1 font-display text-3xl tracking-[0.4em] text-coffee">{o.delivery_otp}</p>
                      <p className="mt-1 text-xs text-brown/60">
                        {arriving
                          ? "Your rider is on the way — read this out when your food arrives."
                          : "Share this with the rider only when your food is handed to you."}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-brown/10 pt-3">
                    <span className="text-xs uppercase text-brown/50">
                      {o.payment_method === "cod" ? "Cash on Delivery" : "Online (UPI)"}
                    </span>
                    <span className="font-semibold text-coffee">{formatINR(Number(o.total))}</span>
                  </div>

                  {/* Ordering the same thing again is the most common thing a
                      happy customer wants to do — make it one tap. */}
                  {!live && (
                    <div className="mt-3">
                      <ReorderButton orderId={o.id} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
