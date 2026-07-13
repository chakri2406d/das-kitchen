"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="rounded-full border border-brown/25 px-4 py-1.5 text-sm font-medium text-brown hover:bg-brown/5"
    >
      Sign out
    </button>
  );
}
