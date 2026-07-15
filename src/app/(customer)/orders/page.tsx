import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { createClient } from "@/lib/supabase/server";
import { formatINR, ORDER_STATUS_LABEL } from "@/lib/utils";

export const dynamic = "force-dynamic";

type OrderItem = { item_name: string; quantity: number };
type OrderRow = {
  id: string;
  order_number: string | null;
  status: string;
  total: number;
  payment_method: string;
  placed_at: string;
  delivery_otp: string | null;
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

  const { data } = user
    ? await supabase
        .from("orders")
        .select(
          "id, order_number, status, total, payment_method, placed_at, delivery_otp, order_items(item_name, quantity)"
        )
        .eq("customer_id", user.id)
        .order("placed_at", { ascending: false })
    : { data: [] };

  const orders = (data ?? []) as unknown as OrderRow[];

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl text-coffee">My Orders</h1>

        {placed && (
          <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800">
            Order <span className="font-semibold">{placed}</span> placed! We&apos;ll start preparing it shortly.
          </div>
        )}

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
                      <p className="text-xs text-brown/50">{new Date(o.placed_at).toLocaleString("en-IN")}</p>
                    </div>
                    <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-coffee">
                      {ORDER_STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-brown/70">
                    {(o.order_items ?? []).map((i) => `${i.item_name} ×${i.quantity}`).join(", ")}
                  </p>

                  {/* Delivery OTP — the customer reads this to the rider on handover. */}
                  {live && o.delivery_otp && (
                    <div
                      className={
                        arriving
                          ? "mt-4 rounded-xl border border-gold/50 bg-gold-soft/30 p-4"
                          : "mt-4 rounded-xl border border-brown/10 bg-white p-4"
                      }
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-brown/60">
                        Delivery OTP
                      </p>
                      <p className="mt-1 font-display text-3xl tracking-[0.4em] text-coffee">{o.delivery_otp}</p>
                      <p className="mt-1 text-xs text-brown/60">
                        {arriving
                          ? "Your rider is on the way — read this out when your food arrives."
                          : "Share this with the rider only when your food is handed to you."}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-brown/10 pt-3">
                    <span className="text-xs uppercase text-brown/50">
                      {o.payment_method === "cod" ? "Cash on Delivery" : o.payment_method}
                    </span>
                    <span className="font-semibold text-coffee">{formatINR(Number(o.total))}</span>
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
