import { createClient } from "@/lib/supabase/server";
import { RidersManager, type RiderRow } from "./riders-manager";

export const dynamic = "force-dynamic";

type ProfileRow = { id: string; full_name: string | null; email: string | null; phone: string | null };
type PartnerRow = {
  id: string;
  vehicle_type: string | null;
  vehicle_number: string | null;
  status: string | null;
  is_verified: boolean;
  total_deliveries: number;
};

export default async function AdminRidersPage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: partners }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, phone").eq("role", "delivery_partner").order("full_name"),
    supabase.from("delivery_partners").select("id, vehicle_type, vehicle_number, status, is_verified, total_deliveries"),
  ]);

  const partnerById = new Map((partners ?? []).map((p) => [p.id, p as PartnerRow]));

  const riders: RiderRow[] = ((profiles ?? []) as ProfileRow[]).map((p) => {
    const dp = partnerById.get(p.id);
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      vehicle_type: dp?.vehicle_type ?? null,
      vehicle_number: dp?.vehicle_number ?? null,
      status: dp?.status ?? "offline",
      is_verified: dp?.is_verified ?? false,
      total_deliveries: dp?.total_deliveries ?? 0,
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-3xl text-coffee">Delivery Partners</h1>
      <p className="mt-2 text-brown/70">
        Turn a customer account into a rider. They&apos;ll get the delivery portal and show up in
        &ldquo;Assign rider&rdquo; on orders.
      </p>
      <div className="mt-6">
        <RidersManager riders={riders} />
      </div>
    </div>
  );
}
