import { Navbar } from "@/components/layout/navbar";
import { getCurrentProfile } from "@/lib/supabase/server";

export default async function OrdersPage() {
  const profile = await getCurrentProfile();
  return (
    <main className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl text-coffee">My Orders</h1>
        <p className="mt-3 text-brown/70">
          Signed in as {profile?.full_name ?? profile?.email ?? "guest"}. Live order status and
          delivery tracking (via Supabase Realtime) attach here.
        </p>
      </div>
    </main>
  );
}
