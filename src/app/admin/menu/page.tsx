import { createClient } from "@/lib/supabase/server";
import type { Category, MenuItem } from "@/types/database";
import { MenuManager } from "./menu-manager";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from("categories").select("*").order("display_order"),
    supabase.from("menu_items").select("*").order("name"),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl text-coffee">Menu</h1>
      <p className="mt-2 text-brown/70">Add dishes, set availability, and mark Today&apos;s Specials.</p>
      <div className="mt-6">
        <MenuManager categories={(categories ?? []) as Category[]} items={(items ?? []) as MenuItem[]} />
      </div>
    </div>
  );
}
