"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  LayoutDashboard, Layers, Trophy, Columns3, LayoutGrid, Play,
  Settings, HelpCircle, LogOut,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const overviewNav = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Models", href: "/models", icon: Layers },
  { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { label: "Compare", href: "/compare", icon: Columns3 },
];

const evalNav = [
  { label: "Spaces", href: "/spaces", icon: LayoutGrid },
  { label: "Evaluations", href: "/evaluations", icon: Play },
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
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
  return (
    <Sidebar collapsible="icon" className="relative border-r border-slate-200 bg-white">
      <CollapseToggle />

      <SidebarHeader className="px-3 py-4">
        <Link href="/" className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
            <span className="text-sm font-bold text-white">O</span>
          </div>
          <span className="text-[15px] font-bold tracking-tight text-slate-900 group-data-[collapsible=icon]:hidden">
            Orbbit
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 group-data-[collapsible=icon]:px-0">
        <NavGroup label="Overview" items={overviewNav} pathname={pathname} />
        <NavGroup label="Evaluation" items={evalNav} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-100 p-2 group-data-[collapsible=icon]:px-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Help" className="text-slate-500 hover:bg-slate-50 hover:text-slate-700">
              <HelpCircle className="h-4 w-4 shrink-0" /><span>Help & Docs</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings" render={<Link href="/settings" />} className="text-slate-500 hover:bg-slate-50 hover:text-slate-700">
              <Settings className="h-4 w-4 shrink-0" /><span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sign Out" className="text-slate-500 hover:bg-red-50 hover:text-red-600">
              <LogOut className="h-4 w-4 shrink-0" /><span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
