"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

// Only allow same-site redirect targets (avoids open-redirect via ?next=).
function safeNext(next: string | null) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

export function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  );
}

function LoginFormInner() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Surfaces failures handed back by /auth/callback (e.g. Google not configured).
  const [error, setError] = useState<string | null>(params.get("error"));
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return setError(error.message);
    }
    // Hard navigation so the freshly-set session cookie is present on the
    // very next server request (prevents the "log in again" bounce).
    window.location.assign(next);
  }

  async function signInWithGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) setError(error.message);
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
            onKeyDown={(e) => e.key === "Enter" && !loading && signInWithEmail()}
            className="w-full rounded-xl border border-brown/20 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold"
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && signInWithEmail()}
            className="w-full rounded-xl border border-brown/20 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={signInWithEmail} disabled={loading} className="w-full">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </div>

        <div className="my-4 flex items-center gap-3 text-xs text-brown/50">
          <span className="h-px flex-1 bg-brown/15" /> or <span className="h-px flex-1 bg-brown/15" />
        </div>

        <Button onClick={signInWithGoogle} variant="outline" className="w-full">Continue with Google</Button>

        <p className="mt-6 text-center text-sm text-brown/70">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-gold-dark hover:underline">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
