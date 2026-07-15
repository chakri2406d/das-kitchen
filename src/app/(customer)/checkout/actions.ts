"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CheckoutInput = {
  fullName: string;
  phone: string;
  houseNumber: string;
  street: string;
  landmark: string;
  area: string;
  city: string;
  pincode: string;
  notes: string;
  lat: number | null;
  lng: number | null;
  couponCode: string | null;
};

export type PlaceOrderResult =
  | { ok: true; orderNumber: string }
  | { ok: false; error: string };

export type CouponResult =
  | { ok: true; couponId: string; code: string; discount: number; label: string }
  | { ok: false; error: string };

type CartRow = {
  quantity: number;
  menu_items: { id: string; name: string; price: number } | null;
};

const rupees = (n: number) => `₹${Math.round(n)}`;

/** Human message for each reason the database function can return. */
function couponError(reason: string, code: string | null, minRequired: number | null): string {
  switch (reason) {
    case "not_found":
      return "That coupon code isn't valid.";
    case "expired":
      return `Coupon ${code} has expired.`;
    case "limit_reached":
      return `Coupon ${code} has been fully used.`;
    case "min_order":
      return `Coupon ${code} needs a minimum order of ${rupees(Number(minRequired ?? 0))}.`;
    case "no_discount":
      return "That coupon gives no discount on this cart.";
    default:
      return "That coupon can't be applied.";
  }
}

/** Checks a coupon against a subtotal (used for the live "Apply" button). */
export async function validateCoupon(code: string, subtotal: number): Promise<CouponResult> {
  const supabase = await createClient();
  const clean = code.trim();
  if (!clean) return { ok: false, error: "Enter a coupon code." };

  const { data, error } = await supabase.rpc("apply_coupon", { p_code: clean, p_subtotal: subtotal });
  if (error) return { ok: false, error: error.message };

  const row = data?.[0];
  if (!row || row.reason !== "ok" || !row.coupon_id) {
    return { ok: false, error: couponError(row?.reason ?? "not_found", row?.code ?? clean, row?.min_required ?? null) };
  }
  return {
    ok: true,
    couponId: row.coupon_id,
    code: row.code ?? clean,
    discount: Number(row.discount),
    label: row.label ?? "",
  };
}

export async function placeOrder(input: CheckoutInput): Promise<PlaceOrderResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to place an order." };

  // ---- Cart -----------------------------------------------------------------
  const { data: cart } = await supabase
    .from("cart_items")
    .select("quantity, menu_items(id, name, price)")
    .eq("user_id", user.id);

  const items = ((cart ?? []) as unknown as CartRow[]).filter((r) => r.menu_items);
  if (items.length === 0) return { ok: false, error: "Your cart is empty." };

  const subtotal = items.reduce((sum, r) => sum + Number(r.menu_items!.price) * r.quantity, 0);

  // ---- Kitchen rules (enforced server-side, never trust the browser) --------
  const { data: settings } = await supabase
    .from("business_settings")
    .select("status, is_accepting_orders, min_order_amount, delivery_fee")
    .eq("id", 1)
    .single();

  if (settings && (settings.status === "closed" || !settings.is_accepting_orders)) {
    return { ok: false, error: "The kitchen isn't accepting orders right now. Please try again later." };
  }

  const minOrder = Number(settings?.min_order_amount ?? 0);
  if (minOrder > 0 && subtotal < minOrder) {
    return {
      ok: false,
      error: `Minimum order is ${rupees(minOrder)}. Add ${rupees(minOrder - subtotal)} more to your cart.`,
    };
  }

  const deliveryFee = Number(settings?.delivery_fee ?? 0);

  // ---- Coupon (re-validated here, not taken on trust) ----------------------
  let discount = 0;
  let couponId: string | null = null;
  if (input.couponCode?.trim()) {
    const res = await validateCoupon(input.couponCode, subtotal);
    if (!res.ok) return { ok: false, error: res.error };
    discount = res.discount;
    couponId = res.couponId;
  }

  const total = Math.max(0, subtotal - discount) + deliveryFee;
  const orderNumber = "DK" + Date.now().toString().slice(-8);
  // Generated here rather than relying on the DB trigger — a missing OTP
  // would let a rider confirm delivery without the customer.
  const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));

  const deliveryAddress = {
    full_name: input.fullName,
    phone: input.phone,
    house_number: input.houseNumber,
    street: input.street,
    landmark: input.landmark,
    area: input.area,
    city: input.city,
    pincode: input.pincode,
  };

  await supabase
    .from("profiles")
    .update({ full_name: input.fullName, phone: input.phone })
    .eq("id", user.id);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_id: user.id,
      status: "pending",
      subtotal,
      discount,
      delivery_fee: deliveryFee,
      total,
      coupon_id: couponId,
      payment_method: "cod",
      payment_status: "pending",
      delivery_otp: deliveryOtp,
      delivery_notes: input.notes || null,
      customer_lat: input.lat,
      customer_lng: input.lng,
      delivery_address: deliveryAddress,
      placed_at: new Date().toISOString(),
    })
    .select("id, order_number")
    .single();

  if (orderErr || !order) {
    return { ok: false, error: orderErr?.message ?? "Could not create the order." };
  }

  const orderItems = items.map((r) => ({
    order_id: order.id,
    menu_item_id: r.menu_items!.id,
    item_name: r.menu_items!.name,
    item_price: Number(r.menu_items!.price),
    quantity: r.quantity,
    subtotal: Number(r.menu_items!.price) * r.quantity,
  }));

  const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
  if (itemsErr) return { ok: false, error: itemsErr.message };

  if (couponId) await supabase.rpc("redeem_coupon", { p_coupon_id: couponId });

  await supabase.from("cart_items").delete().eq("user_id", user.id);

  revalidatePath("/orders");
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  return { ok: true, orderNumber: order.order_number ?? orderNumber };
}
