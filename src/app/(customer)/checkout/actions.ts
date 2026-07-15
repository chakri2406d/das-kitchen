"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { distanceKm } from "@/lib/geo";

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
  menu_items: {
    id: string;
    name: string;
    price: number;
    is_available: boolean;
    daily_quantity_limit: number | null;
  } | null;
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

  // One use per customer (the default for promo codes) — checked against this
  // customer's own past orders, so a code can't be farmed forever.
  if (row.once_per_customer) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: prior } = await supabase
        .from("orders")
        .select("id")
        .eq("customer_id", user.id)
        .eq("coupon_id", row.coupon_id)
        .neq("status", "cancelled")
        .limit(1);
      if (prior && prior.length > 0) {
        return { ok: false, error: `You've already used ${row.code ?? clean} on a previous order.` };
      }
    }
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
    .select("quantity, menu_items(id, name, price, is_available, daily_quantity_limit)")
    .eq("user_id", user.id);

  const items = ((cart ?? []) as unknown as CartRow[]).filter((r) => r.menu_items);
  if (items.length === 0) return { ok: false, error: "Your cart is empty." };

  const subtotal = items.reduce((sum, r) => sum + Number(r.menu_items!.price) * r.quantity, 0);

  // ---- Sold out? -----------------------------------------------------------
  const unavailable = items.filter((r) => !r.menu_items!.is_available).map((r) => r.menu_items!.name);
  if (unavailable.length > 0) {
    return {
      ok: false,
      error: `${unavailable.join(", ")} ${unavailable.length === 1 ? "is" : "are"} no longer available. Please remove ${unavailable.length === 1 ? "it" : "them"} from your cart.`,
    };
  }

  // ---- Daily cap: don't sell more than the kitchen cooked -------------------
  for (const r of items) {
    const limit = r.menu_items!.daily_quantity_limit;
    if (limit == null) continue;
    const { data: soldToday } = await supabase.rpc("items_sold_today", { p_item_id: r.menu_items!.id });
    const left = limit - Number(soldToday ?? 0);
    if (left <= 0) {
      return { ok: false, error: `${r.menu_items!.name} is sold out for today.` };
    }
    if (r.quantity > left) {
      return { ok: false, error: `Only ${left} left of ${r.menu_items!.name} today. Please reduce the quantity.` };
    }
  }

  // ---- Kitchen rules (enforced server-side, never trust the browser) --------
  const { data: settings } = await supabase
    .from("business_settings")
    .select("status, is_accepting_orders, min_order_amount, delivery_fee, delivery_radius_km, kitchen_lat, kitchen_lng")
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

  // ---- Too far to deliver? (only when we know both points) ------------------
  const radius = Number(settings?.delivery_radius_km ?? 0);
  if (
    radius > 0 &&
    settings?.kitchen_lat != null &&
    settings?.kitchen_lng != null &&
    input.lat != null &&
    input.lng != null
  ) {
    const away = distanceKm(settings.kitchen_lat, settings.kitchen_lng, input.lat, input.lng);
    if (away > radius) {
      return {
        ok: false,
        error: `Sorry — you're about ${away.toFixed(1)} km away and we only deliver within ${radius} km of the kitchen.`,
      };
    }
  }

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

  // Powers "Best Sellers" / specials ordering.
  await supabase.rpc("bump_order_counts", { p_order_id: order.id });

  if (couponId) await supabase.rpc("redeem_coupon", { p_coupon_id: couponId });

  await supabase.from("cart_items").delete().eq("user_id", user.id);

  revalidatePath("/orders");
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  return { ok: true, orderNumber: order.order_number ?? orderNumber };
}
