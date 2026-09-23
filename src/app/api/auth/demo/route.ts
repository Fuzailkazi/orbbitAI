import { NextRequest, NextResponse } from "next/server";
import {
  GUEST_DEMO_COOKIE,
  GUEST_DEMO_EMAIL,
  GUEST_EMAIL_COOKIE,
  GuestDemoConfigError,
  createGuestDemoToken,
  guestCookieOptions,
} from "@/lib/auth/guest-demo";
import { apiError, errorMessage, isRecord } from "@/lib/api/responses";
import { safeRedirectPath } from "@/lib/auth/redirect";

type DemoAction = "login" | "logout";

/** Sets a freshly signed guest token (HMAC + expiry, see lib/auth/guest-demo.ts). */
function startGuestSession(response: NextResponse): void {
  const options = guestCookieOptions();
  response.cookies.set(GUEST_DEMO_COOKIE, createGuestDemoToken(), options);
  response.cookies.set(GUEST_EMAIL_COOKIE, GUEST_DEMO_EMAIL, options);
}

function endGuestSession(response: NextResponse): void {
  response.cookies.delete(GUEST_DEMO_COOKIE);
  response.cookies.delete(GUEST_EMAIL_COOKIE);
}

async function readAction(request: NextRequest): Promise<DemoAction> {
  // An empty or malformed body means "login" — the login page posts with no body.
  const body: unknown = await request.json().catch(() => null);
  return isRecord(body) && body.action === "logout" ? "logout" : "login";
}

function configErrorResponse(err: unknown) {
  console.error("Guest demo session error:", err);
  return err instanceof GuestDemoConfigError
    ? apiError(err.message, "CONFIG_ERROR", 500)
    : apiError(errorMessage(err, "Failed to start guest session."), "INTERNAL_ERROR", 500);
}

/** POST { action?: "login" | "logout" } — toggles the guest demo session. */
export async function POST(request: NextRequest) {
  const action = await readAction(request);
  const isLogout = action === "logout";

  const response = NextResponse.json({
    success: true,
    message: isLogout ? "Guest demo session ended." : "Guest demo session activated.",
    redirect: isLogout ? "/login" : "/dashboard",
  });

  if (isLogout) {
    endGuestSession(response);
    return response;
  }

  try {
    startGuestSession(response);
  } catch (err) {
    return configErrorResponse(err);
  }
  return response;
}

/**
 * GET /api/auth/demo[?next=/dashboard/…] — one-click "Try demo" link: starts a guest session
 * and opens the dashboard (or the same-origin `next` path, e.g. an evaluation drill-down).
 */
export async function GET(request: NextRequest) {
  // A <Link> prefetch must never mint a session as a side effect of merely viewing a page
  // (demo links set prefetch={false}; this guards any link that forgets to).
  if (request.headers.get("next-router-prefetch")) {
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next, request.url));
  try {
    startGuestSession(response);
  } catch (err) {
    console.error("Guest demo session error:", err);
    return NextResponse.redirect(new URL("/login?error=guest_unavailable", request.url));
  }
  return response;
}
