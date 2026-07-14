import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Runs on every matched request. It:
 *  1. Refreshes the Supabase auth session (keeps cookies fresh).
 *  2. Enforces role-based access to /admin and /delivery, and login-gates
 *     the customer's private pages.
 *
 * IMPORTANT: every response we return (including redirects) must carry the
 * cookies Supabase just refreshed on `response`. If a redirect is returned
 * without them, the browser loses the rotated session and the user is bounced
 * back to /login on the next request — an endless "please log in again" loop.
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

  // Build a redirect that carries over the freshly-refreshed session cookies.
  const redirectTo = (pathname: string, keepNext: boolean) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    if (keepNext) url.searchParams.set("next", path);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // Not logged in but hitting a protected route -> send to login.
  if (needsAuth && !user) {
    return redirectTo("/login", true);
  }

  // Logged in + hitting a role-gated route -> verify role.
  if (user && (isAdminRoute || isDeliveryRoute)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    if (isAdminRoute && role !== "admin") return redirectTo("/", false);
    if (isDeliveryRoute && role !== "delivery_partner") return redirectTo("/", false);
  }

  return response;
}
