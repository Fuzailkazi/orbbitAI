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
      <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 group-data-[collapsible=icon]:hidden">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={isActive}
                  tooltip={item.label}
                  render={<Link href={item.href} />}
                  className={isActive ? "bg-indigo-50 text-indigo-600 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
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
      className="absolute -right-3 top-13 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50"
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <ChevronLeft
        className={`h-3.5 w-3.5 text-slate-500 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
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
      }
    }
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUserEmail(null);
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon" className="relative border-r border-slate-200 bg-white h-full">
      <CollapseToggle />

      <SidebarHeader className="px-3 py-3 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 shadow-sm">
            <span className="text-xs font-bold text-white">O</span>
          </div>
          <span className="text-[15px] font-bold tracking-tight text-slate-900 group-data-[collapsible=icon]:hidden">
            Orbbit
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 group-data-[collapsible=icon]:px-0 overflow-y-auto">
        <NavGroup label="Overview" items={overviewNav} pathname={pathname} />
        <NavGroup label="Evaluation" items={evalNav} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter className="shrink-0 border-t border-slate-100 p-1.5 group-data-[collapsible=icon]:px-0">
        <SidebarMenu>
          {userEmail ? (
            <>
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-500 group-data-[collapsible=icon]:hidden truncate">
                  <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{userEmail}</span>
                </div>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleSignOut}
                  tooltip="Sign Out"
                  className="text-slate-500 hover:bg-slate-50 hover:text-slate-700"
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
                className="text-indigo-600 font-medium hover:bg-indigo-50"
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
