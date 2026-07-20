import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth landing point (Google). Supabase redirects here with a `code` which we
 * exchange for a session.
 *
 * Whatever goes wrong, the customer only ever sees plain language. Internal
 * details (provider names, raw API errors) are logged for us, never shown —
 * they mean nothing to a hungry customer and shouldn't leak our setup.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");

  const backToLogin = (reason: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);

  // No code means the customer closed the Google window or pressed cancel.
  // That's a normal thing to do, not a failure worth alarming them about.
  if (providerError || !code) {
    if (providerError) console.error("[auth/callback] provider error:", providerError);
    return backToLogin("Sign-in was cancelled. Please try again.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] code exchange failed:", error.message);
    return backToLogin("We couldn't sign you in with Google. Please try again.");
  }

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
