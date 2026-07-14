"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FoodType } from "@/types/database";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false as const, error: "Not signed in." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { supabase, ok: false as const, error: "Admins only." };
  return { supabase, ok: true as const };
}

function revalidate() {
  revalidatePath("/admin/menu");
  revalidatePath("/menu");
  revalidatePath("/", "layout"); // homepage specials
}

export type MenuItemInput = {
  id?: string;
  name: string;
  description: string;
  price: number;
  category_id: string | null;
  food_type: FoodType;
  is_available: boolean;
  is_special: boolean;
  prep_time_minutes: number;
  daily_quantity_limit: number | null;
  image_url: string | null;
};

export async function saveMenuItem(input: MenuItemInput): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!input.name.trim()) return { ok: false, error: "Name is required." };
  if (!(input.price >= 0)) return { ok: false, error: "Price must be zero or more." };

  const row = {
    name: input.name.trim(),
    description: input.description || null,
    price: input.price,
    category_id: input.category_id,
    food_type: input.food_type,
    is_available: input.is_available,
    is_special: input.is_special,
    prep_time_minutes: input.prep_time_minutes,
    daily_quantity_limit: input.daily_quantity_limit,
    image_url: input.image_url,
  };

  const { error } = input.id
    ? await auth.supabase.from("menu_items").update(row).eq("id", input.id)
    : await auth.supabase.from("menu_items").insert(row);

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteMenuItem(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { error } = await auth.supabase.from("menu_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function toggleAvailable(id: string, next: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { error } = await auth.supabase.from("menu_items").update({ is_available: next }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function toggleSpecial(id: string, next: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { error } = await auth.supabase.from("menu_items").update({ is_special: next }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function createCategory(name: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Category name is required." };
  const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const { error } = await auth.supabase.from("categories").insert({ name: clean, slug });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function toggleCategoryActive(id: string, next: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { error } = await auth.supabase.from("categories").update({ is_active: next }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
