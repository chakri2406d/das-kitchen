import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { CartItemRow, type CartRow } from "@/components/cart/cart-item-row";
import { createClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

type CartQueryRow = {
  id: string;
  quantity: number;
  menu_items: { name: string; price: number; food_type: string } | null;
};

export default async function CartPage() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/login?next=/cart");

  const { data } = await supabase
    .from("cart_items")
    .select("id, quantity, menu_items(name, price, food_type)")
    .eq("user_id", user.id)
    .order("created_at");

  const rows: CartRow[] = ((data ?? []) as unknown as CartQueryRow[])
    .filter((r) => r.menu_items)
    .map((r) => ({
      id: r.id,
      quantity: r.quantity,
      name: r.menu_items!.name,
      price: Number(r.menu_items!.price),
      food_type: r.menu_items!.food_type,
    }));

  const subtotal = rows.reduce((sum, r) => sum + r.price * r.quantity, 0);
  const itemCount = rows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12 sm:px-6">
        <h1 className="font-display text-3xl text-coffee">Your Cart</h1>

        {rows.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-brown/20 p-10 text-center">
            <p className="text-brown/70">Your cart is empty.</p>
            <Link
              href="/menu"
              className="mt-4 inline-block rounded-full bg-gold px-6 py-2 text-sm font-medium text-white hover:bg-gold-dark"
            >
              Browse the menu
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-brown/70">
              {itemCount} item{itemCount === 1 ? "" : "s"} in your cart
            </p>

            <div className="mt-6 space-y-3">
              {rows.map((row) => (
                <CartItemRow key={row.id} row={row} />
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
              <div className="flex items-center justify-between text-brown/80">
                <span>Subtotal</span>
                <span className="font-semibold text-coffee">{formatINR(subtotal)}</span>
              </div>
              <p className="mt-2 text-xs text-brown/50">
                Delivery fee &amp; taxes are calculated at checkout.
              </p>
              <Link
                href="/checkout"
                className="mt-5 block w-full rounded-full bg-coffee px-6 py-3 text-center text-sm font-medium text-cream hover:bg-brown"
              >
                Proceed to checkout
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
