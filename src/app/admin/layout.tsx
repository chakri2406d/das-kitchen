import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { getCurrentProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/");

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-50 border-b border-brown/10 bg-soft/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Logo withWordmark />
            <span className="shrink-0 rounded-full bg-coffee px-3 py-1 text-xs font-semibold text-cream">Admin</span>
          </div>
          <SignOutButton />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3 sm:px-6">
          <AdminNav />
        </div>
      </header>
      {children}
    </div>
  );
}
