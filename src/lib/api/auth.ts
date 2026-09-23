import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route";
import { GUEST_DEMO_COOKIE, isGuestDemoValue } from "@/lib/auth/guest-demo";
import { apiError, type ApiErrorBody } from "./responses";

export type ApiSession =
  | { kind: "user"; userId: string; email: string | null }
  | { kind: "guest" };

/** Resolves the caller: a Supabase user, the guest demo session, or null. */
export async function getApiSession(): Promise<ApiSession | null> {
  try {
    const supabase = await createRouteHandlerClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      return { kind: "user", userId: data.user.id, email: data.user.email ?? null };
    }
  } catch {
    // Supabase auth unreachable — fall through to the guest check.
  }

  // Signed + unexpired guest token only; forged or legacy "true" cookies fall through to logged out.
  const cookieStore = await cookies();
  if (isGuestDemoValue(cookieStore.get(GUEST_DEMO_COOKIE)?.value)) {
    return { kind: "guest" };
  }
  return null;
}

export type RequireSessionResult =
  | { ok: true; session: ApiSession }
  | { ok: false; response: NextResponse<ApiErrorBody> };

/** Guard for mutating routes: returns a typed 401 when the caller is neither signed in nor a guest. */
export async function requireApiSession(): Promise<RequireSessionResult> {
  const session = await getApiSession();
  if (!session) {
    return {
      ok: false,
      response: apiError("Sign in or start a guest demo session to continue.", "UNAUTHORIZED", 401),
    };
  }
  return { ok: true, session };
}
