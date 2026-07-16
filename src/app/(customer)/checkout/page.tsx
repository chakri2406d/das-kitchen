import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { CheckoutForm } from "@/components/cart/checkout-form";
import { createClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

type CartRow = { quantity: number; menu_items: { price: number } | null };

export default async function CheckoutPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/checkout");

  const [{ data: cart }, { data: settings }, { data: profile }, { data: saved }] = await Promise.all([
    supabase.from("cart_items").select("quantity, menu_items(price)").eq("user_id", user.id),
    supabase
      .from("business_settings")
      .select("status, is_accepting_orders, min_order_amount, delivery_fee, upi_id, upi_name")
      .eq("id", 1)
      .single(),
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).single(),
    supabase
      .from("addresses")
      .select("id, label, house_number, street, landmark, area, city, pincode")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const items = ((cart ?? []) as unknown as CartRow[]).filter((r) => r.menu_items);
  if (items.length === 0) redirect("/cart");

  const subtotal = items.reduce((sum, r) => sum + Number(r.menu_items!.price) * r.quantity, 0);
  const deliveryFee = Number(settings?.delivery_fee ?? 0);
  const minOrder = Number(settings?.min_order_amount ?? 0);

  const kitchenClosed = settings?.status === "closed" || settings?.is_accepting_orders === false;
  const belowMinimum = minOrder > 0 && subtotal < minOrder;

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl text-coffee">Checkout</h1>

        {kitchenClosed ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="font-display text-xl text-red-800">The kitchen is closed right now</p>
            <p className="mt-2 text-sm text-red-700">
              We&apos;re not accepting orders at the moment. Your cart is saved — please check back when we reopen.
            </p>
            <Link
              href="/menu"
              className="mt-5 inline-block rounded-full border border-red-300 px-6 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            >
              Back to menu
            </Link>
          </div>
        ) : belowMinimum ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
            <p className="font-display text-xl text-amber-900">Almost there</p>
            <p className="mt-2 text-sm text-amber-800">
              Minimum order is {formatINR(minOrder)}. Add {formatINR(minOrder - subtotal)} more to place this order.
            </p>
            <Link
              href="/menu"
              className="mt-5 inline-block rounded-full bg-gold px-6 py-2 text-sm font-medium text-white hover:bg-gold-dark"
            >
              Add more items
            </Link>
          </div>
        ) : (
          <CheckoutForm
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            initialName={profile?.full_name ?? ""}
            initialPhone={profile?.phone ?? ""}
            upiId={settings?.upi_id ?? null}
            upiName={settings?.upi_name ?? "Das Kitchen"}
            savedAddresses={saved ?? []}
          />
        )}
      </div>
    </main>
  );
}
