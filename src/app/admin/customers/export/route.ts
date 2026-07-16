import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { fetchCustomerReport } from "@/lib/reports";
import { istDateStartISO, istDateEndExclusiveISO, formatDateTime, istDateStr } from "@/lib/utils";

// exceljs needs Node APIs — not the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();

  // Admins only — this is every customer's contact details.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || istDateStr();
  const to = searchParams.get("to") || istDateStr();

  const { orders, customers } = await fetchCustomerReport(
    supabase,
    istDateStartISO(from),
    istDateEndExclusiveISO(to)
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "Das Kitchen";
  wb.created = new Date();

  const money = '"₹"#,##0';
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF3B2A20" }, // brand coffee
  };

  // ---- Sheet 1: one row per customer -------------------------------------
  const s1 = wb.addWorksheet("Customers");
  s1.columns = [
    { header: "Customer", key: "name", width: 24 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Email", key: "email", width: 28 },
    { header: "Orders", key: "orders", width: 9 },
    { header: "Delivered", key: "delivered", width: 10 },
    { header: "Cancelled", key: "cancelled", width: 10 },
    { header: "Total spent", key: "totalSpent", width: 13, style: { numFmt: money } },
    { header: "Avg order", key: "avgOrder", width: 12, style: { numFmt: money } },
    { header: "Paid cash", key: "cashSpent", width: 12, style: { numFmt: money } },
    { header: "Paid online", key: "onlineSpent", width: 12, style: { numFmt: money } },
    { header: "First order", key: "firstOrder", width: 20 },
    { header: "Last order", key: "lastOrder", width: 20 },
  ];
  customers.forEach((c) =>
    s1.addRow({
      ...c,
      firstOrder: formatDateTime(c.firstOrder),
      lastOrder: formatDateTime(c.lastOrder),
    })
  );

  // ---- Sheet 2: one row per order ----------------------------------------
  const s2 = wb.addWorksheet("Orders");
  s2.columns = [
    { header: "Order no.", key: "order_number", width: 16 },
    { header: "Placed at", key: "placed_at", width: 20 },
    { header: "Customer", key: "customer", width: 24 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Status", key: "status", width: 16 },
    { header: "Items", key: "items", width: 46 },
    { header: "Subtotal", key: "subtotal", width: 11, style: { numFmt: money } },
    { header: "Discount", key: "discount", width: 11, style: { numFmt: money } },
    { header: "Delivery fee", key: "delivery_fee", width: 12, style: { numFmt: money } },
    { header: "Total", key: "total", width: 11, style: { numFmt: money } },
    { header: "Paid by", key: "paid_by", width: 12 },
    { header: "Payment", key: "payment_status", width: 11 },
    { header: "Address", key: "address", width: 50 },
    { header: "Delivered at", key: "delivered_at", width: 20 },
  ];

  const nameById = new Map(customers.map((c) => [c.id, c]));
  orders.forEach((o) => {
    const addr = o.delivery_address ?? {};
    const c = nameById.get(o.customer_id);
    s2.addRow({
      order_number: o.order_number ?? o.id.slice(0, 8),
      placed_at: formatDateTime(o.placed_at),
      customer: c?.name ?? addr.full_name ?? "Unknown",
      phone: addr.phone ?? c?.phone ?? "",
      status: o.status,
      items: (o.order_items ?? []).map((i) => `${i.item_name} x${i.quantity}`).join(", "),
      subtotal: Number(o.subtotal ?? 0),
      discount: Number(o.discount ?? 0),
      delivery_fee: Number(o.delivery_fee ?? 0),
      total: Number(o.total ?? 0),
      paid_by: o.payment_method === "cod" ? "Cash" : o.payment_method === "upi" ? "Online (UPI)" : o.payment_method,
      payment_status: o.payment_status,
      address: [addr.house_number, addr.street, addr.landmark, addr.area, addr.city, addr.pincode]
        .filter(Boolean)
        .join(", "),
      delivered_at: o.delivered_at ? formatDateTime(o.delivered_at) : "",
    });
  });

  // Style both header rows + freeze them so they stay visible while scrolling.
  [s1, s2].forEach((ws) => {
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFF8EE" } };
    head.fill = headerFill;
    head.height = 20;
    head.alignment = { vertical: "middle" };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `das-kitchen-customers_${from}_to_${to}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
