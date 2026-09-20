import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser();
  const isGuestDemo = request.cookies.get("orbbit_guest_demo")?.value === "true";

  const pathname = request.nextUrl.pathname;

  // Protect all /dashboard and /settings routes — require sign in or guest demo session
  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/settings")) && !user && !isGuestDemo) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect already authenticated users (or guest demo) away from login/signup to dashboard
  if ((pathname === "/login" || pathname === "/signup") && (user || isGuestDemo)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
