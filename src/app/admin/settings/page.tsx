import { createClient } from "@/lib/supabase/server";
import type { BusinessSettings } from "@/types/database";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("business_settings").select("*").eq("id", 1).single();

  const settings = (data ?? {
    id: 1,
    status: "open",
    is_accepting_orders: true,
    min_order_amount: 0,
    delivery_fee: 0,
    delivery_radius_km: 8,
    kitchen_lat: null,
    kitchen_lng: null,
    kitchen_address: null,
    phone: null,
    whatsapp: null,
    email: null,
    fssai_license: null,
    open_time: null,
    close_time: null,
    updated_at: new Date().toISOString(),
  }) as BusinessSettings;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-3xl text-coffee">Settings</h1>
      <p className="mt-2 text-brown/70">Control your kitchen status, delivery charges and business details.</p>
      <div className="mt-6">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
