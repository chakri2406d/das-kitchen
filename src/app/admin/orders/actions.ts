"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/database";

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
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const patch: Record<string, unknown> = { status };
  if (status === "accepted") patch.accepted_at = new Date().toISOString();
  if (status === "delivered") patch.delivered_at = new Date().toISOString();

  const { error } = await auth.supabase.from("orders").update(patch).eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function assignRider(orderId: string, riderId: string | null): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await auth.supabase
    .from("orders")
    .update({ delivery_partner_id: riderId })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
