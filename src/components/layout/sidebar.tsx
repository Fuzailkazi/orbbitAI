"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, LogIn, LogOut } from "lucide-react";
import {
  LayoutDashboard, Layers, Trophy, Columns3, LayoutGrid, Play,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { createBrowserClient } from "@/lib/supabase/client";

const overviewNav = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Models", href: "/dashboard/models", icon: Layers },
  { label: "Leaderboard", href: "/dashboard/leaderboard", icon: Trophy },
  { label: "Compare", href: "/dashboard/compare", icon: Columns3 },
];

const evalNav = [
  { label: "Run Evaluation", href: "/dashboard/evaluate", icon: Play },
  { label: "Spaces", href: "/dashboard/spaces", icon: LayoutGrid },
  { label: "Evaluations", href: "/dashboard/evaluations", icon: Trophy },
];

function NavGroup({ label, items, pathname }: { label: string; items: typeof overviewNav; pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground group-data-[collapsible=icon]:hidden px-2 mb-1">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => {
            const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={isActive}
                  tooltip={item.label}
                  render={<Link href={item.href} />}
                  className={`rounded-lg px-3 py-2 text-sm transition-all ${
                    isActive
                      ? "bg-card text-foreground font-medium border border-border shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2.5 w-full">
                    <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-600" : "text-muted-foreground"}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function CollapseToggle() {
  const { toggleSidebar, state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <button
      onClick={toggleSidebar}
      className="absolute -right-3 top-13 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-transform hover:scale-105"
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <ChevronLeft
        className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isCollapsed ? "rotate-180" : ""}`}
      />
    </button>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      } else if (typeof document !== "undefined" && document.cookie.includes("orbbit_guest_demo=true")) {
        setUserEmail("Guest (Demo)");
      }
    }
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      } else if (typeof document !== "undefined" && document.cookie.includes("orbbit_guest_demo=true")) {
        setUserEmail("Guest (Demo)");
      } else {
        setUserEmail(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    await fetch("/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => {});
    setUserEmail(null);
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon" className="relative border-r border-border bg-background h-full">
      <CollapseToggle />

      <SidebarHeader className="px-3.5 py-4 shrink-0 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background text-xs font-semibold">
            O
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight text-foreground block">
              Orbbit
            </span>
            <span className="text-[11px] text-muted-foreground block -mt-0.5">
              AI Evaluation Platform
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2.5 py-3 group-data-[collapsible=icon]:px-0 overflow-y-auto space-y-1">
        <NavGroup label="Navigation" items={overviewNav} pathname={pathname} />
        <NavGroup label="Evaluation" items={evalNav} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter className="shrink-0 border-t border-border p-2 group-data-[collapsible=icon]:px-0">
        <SidebarMenu>
          {userEmail ? (
            <>
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden rounded-lg bg-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">{userEmail}</span>
                </div>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleSignOut}
                  tooltip="Sign Out"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted text-sm rounded-lg transition-all"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/login" />}
                tooltip="Sign In"
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium rounded-lg justify-center"
              >
                <LogIn className="h-4 w-4 shrink-0" />
                <span>Sign in</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
