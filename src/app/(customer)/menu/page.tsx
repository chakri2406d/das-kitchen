import { Navbar } from "@/components/layout/navbar";
import { MenuBrowser, type MenuSection } from "@/components/menu/menu-browser";
import { CartBar } from "@/components/cart/cart-bar";
import { createClient } from "@/lib/supabase/server";
import { groupMenuItems } from "@/lib/menu";
import type { Category, MenuItem } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: items }, { data: auth }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("is_active", true).order("display_order"),
    supabase
      .from("menu_items")
      .select("id, name, description, price, image_url, food_type, is_special, category_id")
      .eq("is_available", true)
      .order("name"),
    supabase.auth.getUser(),
  ]);

  const cats = (categories ?? []) as Pick<Category, "id" | "name">[];
  const menu = (items ?? []) as MenuItem[];
  const userId = auth.user?.id ?? null;

  // What's already in this customer's cart, so each card opens showing the real
  // quantity instead of a bare "Add".
  const cartQty: Record<string, number> = {};
  if (userId) {
    const { data: cart } = await supabase
      .from("cart_items")
      .select("menu_item_id, quantity")
      .eq("user_id", userId);
    (cart ?? []).forEach((r) => {
      cartQty[r.menu_item_id] = r.quantity;
    });
  }

  // Only show categories that actually have dishes.
  const sections: MenuSection[] = cats
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      groups: groupMenuItems(menu.filter((m) => m.category_id === cat.id)),
    }))
    .filter((s) => s.groups.length > 0);

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12 sm:px-6">
        <div className="animate-fade-up">
          <h1 className="font-display text-4xl text-coffee">Our Menu</h1>
          <p className="mt-2 text-brown/70">Freshly made, every single day.</p>
        </div>

        {sections.length === 0 ? (
          <p className="mt-10 rounded-xl border border-dashed border-brown/20 p-8 text-center text-brown/60">
            No dishes yet. Add items from the admin dashboard.
          </p>
        ) : (
          <MenuBrowser sections={sections} userId={userId} cartQty={cartQty} />
        )}
      </div>
      <div className="h-24" />
      <CartBar />
    </main>
  );
}
