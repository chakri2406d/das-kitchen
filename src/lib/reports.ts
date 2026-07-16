import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type ReportItem = { item_name: string; quantity: number; item_price: number; subtotal: number };

export type ReportOrder = {
  id: string;
  order_number: string | null;
  status: string;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  payment_status: string;
  placed_at: string;
  delivered_at: string | null;
  customer_id: string;
  delivery_address: Record<string, string> | null;
  order_items: ReportItem[];
};

export type ReportCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  orders: number;
  delivered: number;
  cancelled: number;
  totalSpent: number;
  avgOrder: number;
  cashSpent: number;
  onlineSpent: number;
  firstOrder: string;
  lastOrder: string;
};

const COLUMNS =
  "id, order_number, status, subtotal, discount, delivery_fee, total, payment_method, payment_status, placed_at, delivered_at, customer_id, delivery_address, order_items(item_name, quantity, item_price, subtotal)";

/**
 * Everything the Customers report needs, for one date window.
 * Shared by the admin page and the Excel export so the screen and the
 * spreadsheet can never disagree.
 */
export async function fetchCustomerReport(
  supabase: SupabaseClient<Database>,
  fromISO: string,
  toExclusiveISO: string
): Promise<{ orders: ReportOrder[]; customers: ReportCustomer[] }> {
  const { data: rows } = await supabase
    .from("orders")
    .select(COLUMNS)
    .gte("placed_at", fromISO)
    .lt("placed_at", toExclusiveISO)
    .order("placed_at", { ascending: false });

  const orders = (rows ?? []) as unknown as ReportOrder[];
  if (orders.length === 0) return { orders, customers: [] };

  // Names/emails live on profiles, not on the order.
  const ids = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))];
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone")
    .in("id", ids);

  const profiles = new Map((profileRows ?? []).map((p) => [p.id, p]));
  const byCustomer = new Map<string, ReportCustomer>();

  for (const o of orders) {
    const p = profiles.get(o.customer_id);
    const addr = o.delivery_address ?? {};
    let c = byCustomer.get(o.customer_id);

    if (!c) {
      c = {
        id: o.customer_id,
        // Fall back to the name/phone typed at checkout if the profile is thin.
        name: p?.full_name || addr.full_name || "Unknown",
        email: p?.email || "",
        phone: p?.phone || addr.phone || "",
        orders: 0,
        delivered: 0,
        cancelled: 0,
        totalSpent: 0,
        avgOrder: 0,
        cashSpent: 0,
        onlineSpent: 0,
        firstOrder: o.placed_at,
        lastOrder: o.placed_at,
      };
      byCustomer.set(o.customer_id, c);
    }

    c.orders += 1;
    if (o.status === "delivered") c.delivered += 1;
    if (o.status === "cancelled") c.cancelled += 1;

    // Cancelled orders never count as money.
    if (o.status !== "cancelled") {
      const amount = Number(o.total ?? 0);
      c.totalSpent += amount;
      if (o.payment_status === "paid") {
        if (o.payment_method === "cod") c.cashSpent += amount;
        else c.onlineSpent += amount;
      }
    }

    if (o.placed_at < c.firstOrder) c.firstOrder = o.placed_at;
    if (o.placed_at > c.lastOrder) c.lastOrder = o.placed_at;
  }

  const customers = [...byCustomer.values()].map((c) => ({
    ...c,
    avgOrder: c.orders > 0 ? Math.round(c.totalSpent / c.orders) : 0,
  }));
  customers.sort((a, b) => b.totalSpent - a.totalSpent); // best customers first

  return { orders, customers };
}
