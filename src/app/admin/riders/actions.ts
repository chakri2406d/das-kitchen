"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false as const, error: "Not signed in." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { supabase, ok: false as const, error: "Admins only." };
  return { supabase, ok: true as const, userId: user.id };
}

function revalidate() {
  revalidatePath("/admin/riders");
  revalidatePath("/admin/orders");
  revalidatePath("/", "layout");
}

/**
 * Promotes an EXISTING account (found by email) to a delivery partner.
 * The person must have signed up on the site first — only they can create
 * their own password / Google identity.
 */
export async function makeDeliveryPartner(email: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const clean = email.trim().toLowerCase();
  if (!clean) return { ok: false, error: "Enter an email address." };

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("id, role, email, full_name")
    .ilike("email", clean)
    .maybeSingle();

  if (!profile) {
    return {
      ok: false,
      error: `No account found for "${clean}". Ask them to sign up on the site first (with this exact email), then add them here.`,
    };
  }
  if (profile.role === "admin") {
    return { ok: false, error: "That account is an admin — use a different account for delivery." };
  }
  if (profile.role === "delivery_partner") {
    return { ok: false, error: "That account is already a delivery partner." };
  }

  const { error: roleErr } = await auth.supabase
    .from("profiles")
    .update({ role: "delivery_partner" })
    .eq("id", profile.id);
  if (roleErr) return { ok: false, error: roleErr.message };

  // Create their rider record (vehicle/status live here).
  const { error: dpErr } = await auth.supabase
    .from("delivery_partners")
    .upsert({ id: profile.id, status: "offline", is_verified: true });
  if (dpErr) return { ok: false, error: dpErr.message };

  revalidate();
  return { ok: true, message: `${profile.full_name ?? clean} is now a delivery partner. Ask them to sign out and back in.` };
}

/** Demotes a delivery partner back to a normal customer. */
export async function removeDeliveryPartner(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (id === auth.userId) return { ok: false, error: "You can't change your own account here." };

  const { error: roleErr } = await auth.supabase.from("profiles").update({ role: "customer" }).eq("id", id);
  if (roleErr) return { ok: false, error: roleErr.message };

  await auth.supabase.from("delivery_partners").delete().eq("id", id);

  revalidate();
  return { ok: true, message: "Removed from delivery partners." };
}

/** Toggle whether a rider is verified (allowed to take deliveries). */
export async function setRiderVerified(id: string, next: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await auth.supabase.from("delivery_partners").update({ is_verified: next }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
