import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth landing point (Google). Supabase redirects here with a `code` which we
 * exchange for a session. Any failure is sent back to /login with a readable
 * reason instead of silently dumping the user on the homepage logged-out.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");

  const backToLogin = (reason: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);

  // Google/Supabase reported a problem (provider disabled, consent denied, bad redirect URI…)
  if (providerError) return backToLogin(providerError);
  if (!code) return backToLogin("Google did not return a sign-in code. Check the provider setup in Supabase.");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return backToLogin(error.message);

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
