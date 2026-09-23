import { Suspense } from "react";
import { cookies } from "next/headers";
import { DashboardShell, type ShellViewer } from "@/components/layout/dashboard-shell";
import { SidebarViewerFooter, SidebarViewerFooterSkeleton } from "@/components/layout/sidebar";
import { createServerClient } from "@/lib/supabase/server";
import { GUEST_DEMO_COOKIE, isGuestDemoValue } from "@/lib/auth/guest-demo";

async function getViewer(): Promise<ShellViewer | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) return { kind: "user", label: user.email };

  // Signed + unexpired guest token only; forged or legacy "true" cookies fall through to logged out.
  const cookieStore = await cookies();
  if (isGuestDemoValue(cookieStore.get(GUEST_DEMO_COOKIE)?.value)) {
    return { kind: "guest", label: "Guest" };
  }
  return null;
}

/** Request-time (cookies + Supabase auth) — must stay inside Suspense so the shell can prerender. */
async function ViewerFooter() {
  const viewer = await getViewer();
  return <SidebarViewerFooter viewer={viewer} />;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only reports whether the server has a key configured — never exposes the key itself.
  const openRouterConfigured = Boolean(process.env.OPENROUTER_API_KEY);

  return (
    <DashboardShell
      openRouterConfigured={openRouterConfigured}
      viewerFooter={
        <Suspense fallback={<SidebarViewerFooterSkeleton />}>
          <ViewerFooter />
        </Suspense>
      }
    >
      {children}
    </DashboardShell>
  );
}
