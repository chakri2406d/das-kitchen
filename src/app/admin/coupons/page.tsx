import { createClient } from "@/lib/supabase/server";
import type { Coupon } from "@/types/database";
import { CouponsManager } from "./coupons-manager";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-3xl text-coffee">Coupons</h1>
      <p className="mt-2 text-brown/70">Create discount codes and turn them on or off.</p>
      <div className="mt-6">
        <CouponsManager coupons={(data ?? []) as Coupon[]} />
      </div>
    </div>
  );
}
