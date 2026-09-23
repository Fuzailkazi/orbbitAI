import { Suspense, cache, type ReactNode } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { GUEST_DEMO_COOKIE, isGuestDemoValue } from "@/lib/auth/guest-demo";

/**
 * Whether the visitor has a session (Supabase user or signed guest-demo cookie). Request-time
 * only; React `cache` shares one lookup across every auth-aware slot on the page.
 */
const getIsAuthenticated = cache(async (): Promise<boolean> => {
  const cookieStore = await cookies();
  if (isGuestDemoValue(cookieStore.get(GUEST_DEMO_COOKIE)?.value)) return true;
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
});

async function AuthSwitch({ authed, guest }: { authed: ReactNode; guest: ReactNode }) {
  return (await getIsAuthenticated()) ? authed : guest;
}

/**
 * Renders `authed` for signed-in visitors and `guest` otherwise. The guest variant is the
 * Suspense fallback, so it is part of the static shell (what most landing visitors see) and a
 * signed-in visitor's variant streams in as soon as the cookie check resolves.
 */
export function AuthAware({ authed, guest }: { authed: ReactNode; guest: ReactNode }) {
  return (
    <Suspense fallback={guest}>
      <AuthSwitch authed={authed} guest={guest} />
    </Suspense>
  );
}
