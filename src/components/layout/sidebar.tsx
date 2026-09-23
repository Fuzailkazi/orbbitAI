"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Layers, Trophy, Columns3, LayoutGrid, Play, ListChecks,
  LogIn, LogOut, Loader2, type LucideIcon,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarFooter, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { ShellViewer } from "./dashboard-shell";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const overviewNav: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Models", href: "/dashboard/models", icon: Layers },
  { label: "Leaderboard", href: "/dashboard/leaderboard", icon: Trophy },
  { label: "Compare", href: "/dashboard/compare", icon: Columns3 },
];

const evalNav: NavItem[] = [
  { label: "Run Evaluation", href: "/dashboard/evaluate", icon: Play },
  { label: "Spaces", href: "/dashboard/spaces", icon: LayoutGrid },
  { label: "Evaluations", href: "/dashboard/evaluations", icon: ListChecks },
];

/** Exact match for the overview; segment-prefix match elsewhere (so /evaluate ≠ /evaluations). */
function isNavActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavGroup({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground group-data-[collapsible=icon]:hidden">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => {
            const isActive = isNavActive(item.href, pathname);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={isActive}
                  tooltip={item.label}
                  render={<Link href={item.href} aria-current={isActive ? "page" : undefined} />}
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "border-border bg-card font-medium text-foreground shadow-sm data-active:bg-card data-active:text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-brand" : "text-muted-foreground")} />
                  <span className="truncate">{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/** Viewer-dependent footer content: identity + sign out, or a sign-in button when logged out. */
export function SidebarViewerFooter({ viewer }: { viewer: ShellViewer | null }) {
  if (viewer) return <ViewerFooter viewer={viewer} />;
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={<Link href="/login" />}
          tooltip="Sign in"
          className="justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
        >
          <LogIn className="h-4 w-4 shrink-0" />
          <span>Sign in</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/** Same footprint as the expanded identity card / collapsed sign-out button, shown while the viewer streams in. */
export function SidebarViewerFooterSkeleton() {
  return (
    <SidebarMenu aria-hidden>
      <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2 shadow-2xs">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-muted" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-28 max-w-full rounded bg-muted" />
            <div className="h-2.5 w-16 rounded bg-muted" />
          </div>
        </div>
      </SidebarMenuItem>
      <SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
        <div className="mx-auto h-8 w-8 rounded-lg bg-muted" />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function SidebarNav({ pathname }: { pathname: string }) {
  return (
    <>
      <NavGroup label="Navigation" items={overviewNav} pathname={pathname} />
      <NavGroup label="Evaluation" items={evalNav} pathname={pathname} />
    </>
  );
}

function ActiveSidebarNav() {
  const pathname = usePathname();
  return <SidebarNav pathname={pathname} />;
}

/** Warms the sign-out chunk on hover/focus so the click doesn't wait on a download. */
function preloadSupabaseClient() {
  void import("@/lib/supabase/client");
}

function ViewerFooter({ viewer }: { viewer: ShellViewer }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const initial = viewer.kind === "guest" ? "G" : viewer.label.charAt(0).toUpperCase();
  const subtitle = viewer.kind === "guest" ? "Demo session" : "Signed in";

  async function handleSignOut() {
    setSigningOut(true);
    try {
      // Loaded on demand: supabase-js is only needed to sign out, so it stays out of the shell
      // bundle every dashboard page downloads.
      const { createBrowserClient } = await import("@/lib/supabase/client");
      await createBrowserClient().auth.signOut();
      await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } catch (err) {
      console.error("Sign out failed", err);
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <SidebarMenu>
      {/* Expanded: identity row with an inline sign-out action */}
      <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2 shadow-2xs">
          <div
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-foreground"
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-foreground" title={viewer.label}>
              {viewer.label}
            </p>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" aria-hidden />
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            onPointerEnter={preloadSupabaseClient}
            onFocus={preloadSupabaseClient}
            disabled={signingOut}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
          >
            {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          </button>
        </div>
      </SidebarMenuItem>

      {/* Collapsed (icon rail): sign-out only */}
      <SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
        <SidebarMenuButton
          onClick={handleSignOut}
          onPointerEnter={preloadSupabaseClient}
          onFocus={preloadSupabaseClient}
          disabled={signingOut}
          tooltip="Sign out"
          className="rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Sign out</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/**
 * The footer is a slot so the (dashboard) layout can stream the viewer (cookies + auth) inside
 * a Suspense boundary while the rest of the sidebar is part of the static shell.
 */
export function AppSidebar({ footer }: { footer: React.ReactNode }) {
  return (
    <Sidebar collapsible="icon" className="h-full border-r border-border bg-background">
      <SidebarHeader className="flex shrink-0 flex-row items-center justify-between gap-2 border-b border-border px-3.5 py-3 group-data-[collapsible=icon]:px-2">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-xs font-semibold text-background shadow-2xs">
            O
          </div>
          <div className="truncate group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
              Orbbit
            </span>
            <span className="-mt-0.5 block truncate text-[11px] text-muted-foreground">
              AI Evaluation Platform
            </span>
          </div>
        </Link>
        <SidebarTrigger className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground group-data-[collapsible=icon]:hidden" />
      </SidebarHeader>

      <SidebarContent className="space-y-1 overflow-y-auto px-2.5 py-3 group-data-[collapsible=icon]:px-0">
        {/* Dynamic routes ([id]) have no pathname in the prerendered shell; the nav renders
            un-highlighted there for an instant and picks up the active item at request time. */}
        <Suspense fallback={<SidebarNav pathname="" />}>
          <ActiveSidebarNav />
        </Suspense>
      </SidebarContent>

      <SidebarFooter className="shrink-0 border-t border-border p-2.5 group-data-[collapsible=icon]:px-0">
        {footer}
      </SidebarFooter>
    </Sidebar>
  );
}
