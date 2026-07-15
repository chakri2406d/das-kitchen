"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BusinessStatus } from "@/types/database";

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

/** Quick toggle used by the Open / Busy / Closed buttons. */
export async function setBusinessStatus(status: BusinessStatus): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await auth.supabase
    .from("business_settings")
    .update({ status, is_accepting_orders: status !== "closed" })
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout"); // refresh the navbar status pill everywhere
  return { ok: true };
}

export type SettingsInput = {
  is_accepting_orders: boolean;
  kitchen_lat: number | null;
  kitchen_lng: number | null;
  min_order_amount: number;
  delivery_fee: number;
  delivery_radius_km: number;
  kitchen_address: string;
  phone: string;
  whatsapp: string;
  email: string;
  fssai_license: string;
  open_time: string;
  close_time: string;
};

export async function updateSettings(input: SettingsInput): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await auth.supabase
    .from("business_settings")
    .update({
      is_accepting_orders: input.is_accepting_orders,
      kitchen_lat: input.kitchen_lat,
      kitchen_lng: input.kitchen_lng,
      min_order_amount: input.min_order_amount,
      delivery_fee: input.delivery_fee,
      delivery_radius_km: input.delivery_radius_km,
      kitchen_address: input.kitchen_address || null,
      phone: input.phone || null,
      whatsapp: input.whatsapp || null,
      email: input.email || null,
      fssai_license: input.fssai_license || null,
      open_time: input.open_time || null,
      close_time: input.close_time || null,
    })
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
