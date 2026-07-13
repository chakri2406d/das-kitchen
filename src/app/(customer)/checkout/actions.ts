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
};

export type PlaceOrderResult =
  | { ok: true; orderNumber: string }
  | { ok: false; error: string };

type CartRow = {
  quantity: number;
  menu_items: { id: string; name: string; price: number } | null;
};

export async function placeOrder(input: CheckoutInput): Promise<PlaceOrderResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to place an order." };

  const { data: cart } = await supabase
    .from("cart_items")
    .select("quantity, menu_items(id, name, price)")
    .eq("user_id", user.id);

  const items = ((cart ?? []) as unknown as CartRow[]).filter((r) => r.menu_items);
  if (items.length === 0) return { ok: false, error: "Your cart is empty." };

  const subtotal = items.reduce(
    (sum, r) => sum + Number(r.menu_items!.price) * r.quantity,
    0
  );

  const { data: settings } = await supabase
    .from("business_settings")
    .select("delivery_fee")
    .eq("id", 1)
    .single();
  const deliveryFee = Number(settings?.delivery_fee ?? 0);
  const total = subtotal + deliveryFee;

  const orderNumber = "DK" + Date.now().toString().slice(-8);

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
      discount: 0,
      delivery_fee: deliveryFee,
      total,
      payment_method: "cod",
      payment_status: "pending",
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

  await supabase.from("cart_items").delete().eq("user_id", user.id);

  revalidatePath("/orders");
  revalidatePath("/admin");
  return { ok: true, orderNumber: order.order_number ?? orderNumber };
}
