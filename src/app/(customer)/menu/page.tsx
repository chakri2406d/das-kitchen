import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { MenuCard } from "@/components/menu/menu-card";
import { createClient } from "@/lib/supabase/server";
import { groupMenuItems } from "@/lib/menu";
import type { Category, MenuItem } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("is_active", true).order("display_order"),
    supabase
      .from("menu_items")
      .select("id, name, description, price, image_url, food_type, is_special, category_id")
      .eq("is_available", true)
      .order("name"),
  ]);

  const cats = (categories ?? []) as Pick<Category, "id" | "name">[];
  const menu = (items ?? []) as MenuItem[];

  // Only show categories that actually have items.
  const sections = cats
    .map((cat) => ({ cat, groups: groupMenuItems(menu.filter((m) => m.category_id === cat.id)) }))
    .filter((s) => s.groups.length > 0);

  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="animate-fade-up">
          <h1 className="font-display text-4xl text-coffee">Our Menu</h1>
          <p className="mt-2 text-brown/70">Freshly made, every single day.</p>
        </div>

        {sections.length === 0 && (
          <p className="mt-10 rounded-xl border border-dashed border-brown/20 p-8 text-center text-brown/60">
            No dishes yet. Add items from the admin dashboard.
          </p>
        )}

        {/* Category quick-nav */}
        {sections.length > 1 && (
          <div className="sticky top-16 z-30 -mx-4 mt-6 flex gap-2 overflow-x-auto bg-cream/85 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-full sm:px-3">
            {sections.map(({ cat }) => (
              <Link
                key={cat.id}
                href={`#cat-${cat.id}`}
                className="whitespace-nowrap rounded-full bg-brown/5 px-4 py-1.5 text-sm font-medium text-brown transition-colors hover:bg-gold-soft/60 hover:text-coffee"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}

        {sections.map(({ cat, groups }) => (
          <section key={cat.id} id={`cat-${cat.id}`} className="mt-10 scroll-mt-32">
            <h2 className="font-display text-2xl text-coffee">{cat.name}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group, i) => (
                <MenuCard key={group.key} group={group} index={i} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
