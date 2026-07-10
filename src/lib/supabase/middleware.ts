import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Runs on every matched request. It:
 *  1. Refreshes the Supabase auth session (keeps cookies fresh).
 *  2. Enforces role-based access to /admin and /delivery, and login-gates
 *     the customer's private pages.
 *
 * Note: this fetches the user's role from `profiles`. For very high traffic
 * you'd instead add role as a custom JWT claim (Supabase Auth Hook) to avoid
 * the DB round-trip — but for a single-kitchen business this is plenty fast.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith("/admin");
  const isDeliveryRoute = path.startsWith("/delivery");
  const isCustomerPrivate =
    path.startsWith("/cart") ||
    path.startsWith("/orders") ||
    path.startsWith("/checkout") ||
    path.startsWith("/profile");

  const needsAuth = isAdminRoute || isDeliveryRoute || isCustomerPrivate;

  // Not logged in but hitting a protected route -> send to login.
  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Logged in + hitting a role-gated route -> verify role.
  if (user && (isAdminRoute || isDeliveryRoute)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    if (isAdminRoute && role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (isDeliveryRoute && role !== "delivery_partner") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}
