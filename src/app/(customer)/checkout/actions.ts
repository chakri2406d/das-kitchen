"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { distanceKm, quoteDelivery } from "@/lib/geo";
import { sendPushToAdmins } from "@/lib/push";
import type { PaymentMethod } from "@/types/database";

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
  paymentMethod: PaymentMethod; // what they CHOSE; the rider confirms what actually happened
  /** The delivery fee the checkout page displayed. Checked, never trusted. */
  expectedDeliveryFee?: number;
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

  // ---- Location is mandatory ------------------------------------------------
  // The rider needs an exact pin; never let an order through without one.
  if (input.lat == null || input.lng == null) {
    return { ok: false, error: "Please share your delivery location before placing the order." };
  }

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
  const { data: settings, error: settingsErr } = await supabase
    .from("business_settings")
    .select(
      "status, is_accepting_orders, min_order_amount, delivery_fee, delivery_radius_km, extra_km_fee, max_delivery_km, kitchen_lat, kitchen_lng, upi_id"
    )
    .eq("id", 1)
    .single();

  if (settingsErr || !settings) {
    return {
      ok: false,
      error: "We couldn't check the kitchen's settings just now. Please try again in a moment.",
    };
  }

  if (settings.status === "closed" || !settings.is_accepting_orders) {
    return { ok: false, error: "The kitchen isn't accepting orders right now. Please try again later." };
  }

  const minOrder = Number(settings?.min_order_amount ?? 0);
  if (minOrder > 0 && subtotal < minOrder) {
    return {
      ok: false,
      error: `Minimum order is ${rupees(minOrder)}. Add ${rupees(minOrder - subtotal)} more to your cart.`,
    };
  }

  // ---- How far away are they, and what does that cost? ---------------------
  const away =
    settings?.kitchen_lat != null &&
    settings?.kitchen_lng != null &&
    input.lat != null &&
    input.lng != null
      ? distanceKm(settings.kitchen_lat, settings.kitchen_lng, input.lat, input.lng)
      : null;

  const quote = quoteDelivery(away, {
    baseFee: Number(settings?.delivery_fee ?? 0),
    freeRadiusKm: Number(settings?.delivery_radius_km ?? 0),
    perKmFee: Number(settings?.extra_km_fee ?? 0),
    maxKm: settings?.max_delivery_km != null ? Number(settings.max_delivery_km) : null,
  });

  if (quote.refusal) return { ok: false, error: quote.refusal };

  const deliveryFee = quote.fee;

  if (input.expectedDeliveryFee != null && Math.round(input.expectedDeliveryFee) !== Math.round(deliveryFee)) {
    return {
      ok: false,
      error: `The delivery fee just changed to ${rupees(deliveryFee)}. Please refresh the page and check your total before ordering.`,
    };
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

  // Only allow "pay online" if a UPI ID actually exists to pay into.
  const wantsUpi = input.paymentMethod === "upi";
  if (wantsUpi && !settings?.upi_id) {
    return { ok: false, error: "Online payment isn't set up yet. Please choose Cash on Delivery." };
  }
  const paymentMethod: PaymentMethod = wantsUpi ? "upi" : "cod";

  const total = Math.max(0, subtotal - discount) + deliveryFee;
  const orderNumber =
    "DK" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2, "0");
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
      payment_method: paymentMethod,
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

  // Remember this address so they never type it twice.
  const { data: known } = await supabase
    .from("addresses")
    .select("id")
    .eq("user_id", user.id)
    .eq("house_number", input.houseNumber)
    .eq("area", input.area)
    .eq("pincode", input.pincode)
    .maybeSingle();

  if (!known) {
    await supabase.from("addresses").insert({
      user_id: user.id,
      label: input.area || "Home",
      house_number: input.houseNumber || null,
      street: input.street || null,
      landmark: input.landmark || null,
      area: input.area || null,
      city: input.city || null,
      pincode: input.pincode || null,
      latitude: input.lat,
      longitude: input.lng,
    });
  }

  // Wake the kitchen: this reaches the owner's phone even with the browser shut.
  const itemSummary = items
    .map((r) => `${r.menu_items!.name} x${r.quantity}`)
    .join(", ");
  await sendPushToAdmins({
    title: `New order ${rupees(total)} - Das Kitchen`,
    body: `#${orderNumber} - ${itemSummary}`,
    url: "/admin/orders",
    tag: order.id,
  });

  // Powers "Best Sellers" / specials ordering.
  await supabase.rpc("bump_order_counts", { p_order_id: order.id });

  if (couponId) await supabase.rpc("redeem_coupon", { p_coupon_id: couponId });

  await supabase.from("cart_items").delete().eq("user_id", user.id);

  revalidatePath("/orders");
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  return { ok: true, orderNumber: order.order_number ?? orderNumber };
}
