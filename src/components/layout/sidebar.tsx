"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Layers, Trophy, Columns3, LayoutGrid, Play,
  Settings, HelpCircle,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarFooter,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const mainNav = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Models", href: "/models", icon: Layers },
  { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { label: "Compare", href: "/compare", icon: Columns3 },
];

const evalNav = [
  { label: "Spaces", href: "/spaces", icon: LayoutGrid },
  { label: "Evaluations", href: "/evaluations", icon: Play },
];

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: typeof mainNav;
  pathname: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={isActive}
                  tooltip={item.label}
                  render={<Link href={item.href} />}
                >
                  <item.icon className="h-4 w-4" />
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

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r border-[#1E293B]/60">
      <SidebarHeader className="px-3 py-4">
        <Link href="/" className="flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-500/20">
            <span className="text-sm font-bold text-white">O</span>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-[15px] font-semibold tracking-tight text-gray-50">
              Orbbit
            </span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-gray-500">
              AI Eval Platform
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <Separator className="mx-3 w-auto bg-[#1E293B]/60" />

      <SidebarContent className="pt-2">
        <NavGroup label="Overview" items={mainNav} pathname={pathname} />
        <NavGroup label="Evaluation" items={evalNav} pathname={pathname} />
      </SidebarContent>

      <SidebarFooter className="pb-3">
        <Separator className="mx-3 mb-2 w-auto bg-[#1E293B]/60" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings" render={<Link href="/settings" />}>
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Help">
              <HelpCircle className="h-4 w-4" />
              <span>Help & Docs</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
