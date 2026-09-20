"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, LogIn, LogOut, User } from "lucide-react";
import {
  LayoutDashboard, Layers, Trophy, Columns3, LayoutGrid, Play,
  Settings,
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
      <SidebarGroupLabel className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-400 group-data-[collapsible=icon]:hidden px-2 mb-1.5 font-semibold">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map((item) => {
            const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={isActive}
                  tooltip={item.label}
                  render={<Link href={item.href} />}
                  className={`rounded-xl px-3 py-2 text-xs font-mono transition-all ${
                    isActive
                      ? "bg-white text-zinc-950 font-semibold border border-black/[0.08] shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-950 hover:bg-black/[0.03]"
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-zinc-950" : "text-zinc-400"}`} />
                    <span className="truncate">{item.label}</span>
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-600 shrink-0" />
                    )}
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
      className="absolute -right-3 top-13 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-black/[0.08] bg-white shadow-2xs transition-transform hover:scale-105"
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <ChevronLeft
        className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
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
        setUserEmail("Guest Reviewer (Demo)");
      }
    }
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      } else if (typeof document !== "undefined" && document.cookie.includes("orbbit_guest_demo=true")) {
        setUserEmail("Guest Reviewer (Demo)");
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
    <Sidebar collapsible="icon" className="relative border-r border-black/[0.08] bg-[#FBFBFA] h-full">
      <CollapseToggle />

      <SidebarHeader className="px-3.5 py-4 shrink-0 border-b border-black/[0.06]">
        <Link href="/" className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white font-mono text-xs font-bold shadow-2xs">
            <span>O</span>
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight text-zinc-950 block">
              Orbbit
            </span>
            <span className="text-[9px] text-zinc-400 font-mono tracking-[0.2em] uppercase block -mt-0.5">
              MEASUREMENT OS
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2.5 py-3 group-data-[collapsible=icon]:px-0 overflow-y-auto space-y-3">
        <NavGroup label="Observatory" items={overviewNav} pathname={pathname} />
        <NavGroup label="Benchmark Lab" items={evalNav} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter className="shrink-0 border-t border-black/[0.06] p-2 group-data-[collapsible=icon]:px-0 bg-[#FBFBFA]">
        <SidebarMenu>
          {userEmail ? (
            <>
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-mono text-zinc-600 group-data-[collapsible=icon]:hidden rounded-lg bg-black/[0.03] border border-black/[0.05]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">{userEmail}</span>
                </div>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleSignOut}
                  tooltip="Sign Out"
                  className="text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.03] text-xs font-mono rounded-lg transition-all"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Sign Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/login" />}
                tooltip="Sign In"
                className="bg-zinc-950 text-white hover:bg-zinc-800 text-xs font-mono font-medium rounded-lg shadow-2xs justify-center"
              >
                <LogIn className="h-4 w-4 shrink-0" />
                <span>Sign In</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
