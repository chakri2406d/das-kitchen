"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CouponType } from "@/types/database";

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

export type CouponInput = {
  code: string;
  coupon_type: CouponType;
  discount_value: number;
  min_order_amount: number;
  max_discount: number | null;
  expiry_date: string | null;
  usage_limit: number | null;
};

export async function createCoupon(input: CouponInput): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const code = input.code.trim().toUpperCase();
  if (!code) return { ok: false, error: "Coupon code is required." };
  if (!(input.discount_value > 0)) return { ok: false, error: "Discount value must be greater than zero." };

  const { error } = await auth.supabase.from("coupons").insert({
    code,
    coupon_type: input.coupon_type,
    discount_value: input.discount_value,
    min_order_amount: input.min_order_amount,
    max_discount: input.max_discount,
    expiry_date: input.expiry_date,
    usage_limit: input.usage_limit,
    is_active: true,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/coupons");
  return { ok: true };
}

export async function toggleCoupon(id: string, next: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { error } = await auth.supabase.from("coupons").update({ is_active: next }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/coupons");
  return { ok: true };
}

export async function deleteCoupon(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { error } = await auth.supabase.from("coupons").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/coupons");
  return { ok: true };
}
