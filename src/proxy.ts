import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { GUEST_DEMO_COOKIE, GUEST_EMAIL_COOKIE, isGuestDemoValue } from "@/lib/auth/guest-demo";

const PROTECTED_PREFIXES = ["/dashboard", "/settings"];
const AUTH_PAGES = new Set(["/login", "/signup"]);

function clearGuestCookies(response: NextResponse): void {
  response.cookies.delete(GUEST_DEMO_COOKIE);
  response.cookies.delete(GUEST_EMAIL_COOKIE);
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let user: User | null = null;
  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    // Refreshes the session cookie. A network failure must not take the whole site down.
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      user = null;
    }
  }

  // Guest cookie must be a valid signed, unexpired token. Forged / legacy unsigned values
  // ("true") are treated as logged out and cleared.
  const guestCookie = request.cookies.get(GUEST_DEMO_COOKIE)?.value;
  const isGuestDemo = isGuestDemoValue(guestCookie);
  const hasStaleGuestCookie = guestCookie !== undefined && !isGuestDemo;
  const { pathname, search } = request.nextUrl;

  // Protected routes require a signed-in user or a guest demo session.
  if (isProtected(pathname) && !user && !isGuestDemo) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(loginUrl);
    if (hasStaleGuestCookie) clearGuestCookies(redirect);
    return redirect;
  }

  // Signed-in users (or guests) don't need the auth pages.
  if (AUTH_PAGES.has(pathname) && (user || isGuestDemo)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (hasStaleGuestCookie) clearGuestCookies(response);
  return response;
}

export const config = {
  // Skip static assets and image optimization; API routes do their own auth checks.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
