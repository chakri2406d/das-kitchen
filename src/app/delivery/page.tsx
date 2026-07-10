import { Logo } from "@/components/brand/logo";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DeliveryDashboard() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "delivery_partner") redirect("/");

  const supabase = await createClient();
  const { data: assigned } = await supabase
    .from("orders")
    .select("id, order_number, status")
    .eq("delivery_partner_id", profile.id)
    .in("status", ["ready_for_pickup", "out_for_delivery"]);

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-brown/10 bg-soft">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Logo withWordmark />
          <span className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-white">Rider</span>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-3xl text-coffee">Your Deliveries</h1>
        <p className="mt-2 text-brown/70">Hi {profile.full_name ?? "rider"} — {assigned?.length ?? 0} active.</p>
        <div className="mt-6 space-y-3">
          {(assigned ?? []).map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-2xl border border-brown/10 bg-soft p-5 shadow-card">
              <div>
                <p className="font-semibold text-coffee">{o.order_number}</p>
                <p className="text-sm text-brown/60">{o.status}</p>
              </div>
              <button className="rounded-full bg-coffee px-4 py-1.5 text-sm font-medium text-cream">Navigate</button>
            </div>
          ))}
          {(!assigned || assigned.length === 0) && (
            <p className="rounded-xl border border-dashed border-brown/20 p-8 text-center text-brown/60">
              No active deliveries. Assigned orders appear here in real time.
            </p>
          )}
        </div>
        <p className="mt-8 text-sm text-brown/60">
          OTP verification, live GPS pings, and call-customer/kitchen actions wire in next.
        </p>
      </div>
    </main>
  );
}
