"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  );
}

function LoginFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    router.push(next);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-2xl border border-brown/10 bg-soft p-8 shadow-warm">
        <div className="flex justify-center"><Logo size={56} /></div>
        <h1 className="mt-5 text-center font-display text-2xl text-coffee">Welcome back</h1>
        <p className="mt-1 text-center text-sm text-brown/70">Sign in to order from Das Kitchen</p>

        <div className="mt-6 space-y-3">
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-brown/20 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold"
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-brown/20 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={signInWithEmail} disabled={loading} className="w-full">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-brown/70">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-gold-dark hover:underline">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
