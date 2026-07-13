"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function SignupForm() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", password: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function signUp() {
    setLoading(true); setError(null); setMsg(null);
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name, phone: form.phone } },
    });
    setLoading(false);
    if (error) return setError(error.message);

    // If email confirmation is off, Supabase returns a session -> log straight in.
    if (data.session) {
      router.push("/menu");
      router.refresh();
      return;
    }
    setMsg("Account created! You can now sign in.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-2xl border border-brown/10 bg-soft p-8 shadow-warm">
        <div className="flex justify-center"><Logo size={56} /></div>
        <h1 className="mt-5 text-center font-display text-2xl text-coffee">Create your account</h1>

        <div className="mt-6 space-y-3">
          {(["full_name", "phone", "email", "password"] as const).map((field) => (
            <input
              key={field}
              type={field === "password" ? "password" : field === "email" ? "email" : "text"}
              placeholder={field === "full_name" ? "Full name" : field[0].toUpperCase() + field.slice(1)}
              value={form[field]}
              onChange={(e) => set(field, e.target.value)}
              className="w-full rounded-xl border border-brown/20 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold"
            />
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {msg && <p className="text-sm text-green-700">{msg}</p>}
          <Button onClick={signUp} disabled={loading} className="w-full">
            {loading ? "Creating…" : "Create account"}
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-brown/70">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-gold-dark hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
