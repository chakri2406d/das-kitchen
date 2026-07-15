"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RiderStatus } from "@/types/database";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function requireRider() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false as const, error: "Not signed in." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "delivery_partner") {
    return { supabase, ok: false as const, error: "Delivery partners only." };
  }
  return { supabase, ok: true as const, userId: user.id };
}

function revalidate() {
  revalidatePath("/delivery");
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/orders");
}

/** Rider marks themselves available / busy / offline. */
export async function setRiderStatus(status: RiderStatus): Promise<ActionResult> {
  const auth = await requireRider();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await auth.supabase.from("delivery_partners").update({ status }).eq("id", auth.userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/delivery");
  return { ok: true };
}

/** Picked the order up from the kitchen -> on the way to the customer. */
export async function startDelivery(orderId: string): Promise<ActionResult> {
  const auth = await requireRider();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await auth.supabase
    .from("orders")
    .update({ status: "out_for_delivery" })
    .eq("id", orderId)
    .eq("delivery_partner_id", auth.userId);
  if (error) return { ok: false, error: error.message };

  await auth.supabase.from("delivery_partners").update({ status: "busy" }).eq("id", auth.userId);
  revalidate();
  return { ok: true, message: "On the way." };
}

/**
 * Completes a delivery. The rider must type the 4-digit OTP the customer reads
 * from their order screen — proof the food actually reached them.
 */
export async function completeDelivery(orderId: string, otp: string): Promise<ActionResult> {
  const auth = await requireRider();
  if (!auth.ok) return { ok: false, error: auth.error };

  const entered = otp.trim();
  if (!entered) return { ok: false, error: "Enter the 4-digit OTP from the customer." };

  const { data: order } = await auth.supabase
    .from("orders")
    .select("id, status, delivery_otp, payment_method")
    .eq("id", orderId)
    .eq("delivery_partner_id", auth.userId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Order not found, or it isn't assigned to you." };
  if (order.status === "delivered") return { ok: false, error: "This order is already marked delivered." };
  if (order.delivery_otp && entered !== order.delivery_otp) {
    return { ok: false, error: "Wrong OTP. Ask the customer to read it from their order screen." };
  }

  const { error } = await auth.supabase
    .from("orders")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
      // Cash collected on handover.
      ...(order.payment_method === "cod" ? { payment_status: "paid" as const } : {}),
    })
    .eq("id", orderId)
    .eq("delivery_partner_id", auth.userId);
  if (error) return { ok: false, error: error.message };

  const { data: dp } = await auth.supabase
    .from("delivery_partners")
    .select("total_deliveries")
    .eq("id", auth.userId)
    .maybeSingle();

  await auth.supabase
    .from("delivery_partners")
    .update({ total_deliveries: (dp?.total_deliveries ?? 0) + 1, status: "available" })
    .eq("id", auth.userId);

  revalidate();
  return { ok: true, message: "Delivered. Nice work!" };
}
