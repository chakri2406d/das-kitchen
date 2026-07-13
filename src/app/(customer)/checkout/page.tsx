import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { CheckoutForm } from "@/components/cart/checkout-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CartRow = { quantity: number; menu_items: { price: number } | null };

export default async function CheckoutPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/checkout");

  const { data: cart } = await supabase
    .from("cart_items")
    .select("quantity, menu_items(price)")
    .eq("user_id", user.id);

  const items = ((cart ?? []) as unknown as CartRow[]).filter((r) => r.menu_items);
  if (items.length === 0) redirect("/cart");

  const subtotal = items.reduce(
    (sum, r) => sum + Number(r.menu_items!.price) * r.quantity,
    0
  );

  const { data: settings } = await supabase
    .from("business_settings")
    .select("delivery_fee")
    .eq("id", 1)
    .single();
  const deliveryFee = Number(settings?.delivery_fee ?? 0);

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl text-coffee">Checkout</h1>
        <CheckoutForm subtotal={subtotal} deliveryFee={deliveryFee} />
      </div>
    </main>
  );
}
