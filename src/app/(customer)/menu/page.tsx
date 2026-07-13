import { Navbar } from "@/components/layout/navbar";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { createClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/utils";
import type { Category, MenuItem } from "@/types/database";

export const revalidate = 60;

export default async function MenuPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from("categories").select("*").eq("is_active", true).order("display_order"),
    supabase.from("menu_items").select("*").eq("is_available", true).order("name"),
  ]);

  const cats = (categories ?? []) as Category[];
  const menu = (items ?? []) as MenuItem[];

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl text-coffee">Our Menu</h1>
        <p className="mt-2 text-brown/70">Freshly made, every single day.</p>

        {cats.length === 0 && (
          <p className="mt-10 rounded-xl border border-dashed border-brown/20 p-8 text-center text-brown/60">
            No categories yet. Run the SQL seed and add items from the admin dashboard.
          </p>
        )}

        {cats.map((cat) => {
          const catItems = menu.filter((m) => m.category_id === cat.id);
          if (catItems.length === 0) return null;
          return (
            <section key={cat.id} className="mt-10">
              <h2 className="font-display text-2xl text-coffee">{cat.name}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {catItems.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-brown/10 bg-soft p-5 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-lg text-coffee">{item.name}</h3>
                        <p className="mt-1 text-sm text-brown/70">{item.description}</p>
                      </div>
                      <span
                        className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${
                          item.food_type === "veg" ? "border-green-600 bg-green-500" : "border-red-600 bg-red-500"
                        }`}
                        title={item.food_type}
                      />
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="font-semibold text-coffee">{formatINR(item.price)}</span>
                      <AddToCartButton menuItemId={item.id} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
