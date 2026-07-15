import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import type { RiderStatus } from "@/types/database";
import { RiderStatusToggle } from "./rider-status";

export const dynamic = "force-dynamic";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "delivery_partner") redirect("/");

  const supabase = await createClient();
  const { data: partner } = await supabase
    .from("delivery_partners")
    .select("status")
    .eq("id", profile.id)
    .maybeSingle();

  const status = (partner?.status ?? "offline") as RiderStatus;

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-50 border-b border-brown/10 bg-soft/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Logo withWordmark />
            <span className="shrink-0 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-white">Rider</span>
          </div>
          <SignOutButton />
        </div>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-3 sm:px-6">
          <p className="min-w-0 truncate text-sm text-brown/70">Hi {profile.full_name ?? "rider"}</p>
          <RiderStatusToggle current={status} />
        </div>
      </header>
      {children}
    </div>
  );
}
