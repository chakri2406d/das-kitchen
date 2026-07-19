"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/types/database";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false as const, error: "Not signed in." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { supabase, ok: false as const, error: "Admins only." };
  return { supabase, ok: true as const, userId: user.id };
}

function revalidate() {
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  // The customer and the rider both show payment state — refresh them too, or
  // they keep serving a cached "paid" after it's been un-marked.
  revalidatePath("/orders");
  revalidatePath("/delivery");
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

/**
 * Admin confirms (or corrects) how an order was paid.
 * Needed because UPI never tells us the money landed — and because riders make
 * mistakes. This is the final word.
 */
export async function setPayment(
  orderId: string,
  method: PaymentMethod,
  status: PaymentStatus
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { data: updated, error } = await auth.supabase
    .from("orders")
    .update({
      payment_method: method,
      payment_status: status,
      payment_confirmed_at: status === "paid" ? new Date().toISOString() : null,
      payment_confirmed_by: status === "paid" ? auth.userId : null,
    })
    .eq("id", orderId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "Couldn't update the payment — the database rejected it." };
  revalidate();
  return { ok: true };
}
