import { Logo } from "@/components/brand/logo";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { formatINR } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function AdminDashboard() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/");

  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: pending }, { count: active }, { data: todays }] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "out_for_delivery"),
    supabase.from("orders").select("total").gte("placed_at", todayStart.toISOString()),
  ]);

  const revenueToday = (todays ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0);

  const cards = [
    { label: "Orders today", value: todays?.length ?? 0 },
    { label: "Revenue today", value: formatINR(revenueToday) },
    { label: "Pending orders", value: pending ?? 0 },
    { label: "Active deliveries", value: active ?? 0 },
  ];

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-brown/10 bg-soft">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo withWordmark />
          <span className="rounded-full bg-coffee px-3 py-1 text-xs font-semibold text-cream">Admin</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-3xl text-coffee">Dashboard</h1>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
              <p className="text-sm text-brown/60">{c.label}</p>
              <p className="mt-2 font-display text-3xl text-coffee">{c.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm text-brown/60">
          Order management, menu &amp; category CRUD, coupons, live map, and sales charts mount here next.
        </p>
      </div>
    </main>
  );
}
