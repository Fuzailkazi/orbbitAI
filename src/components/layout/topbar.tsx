"use client";

import { Search, Bell, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#1E293B]/60 bg-[#0A0F1E]/80 px-4 backdrop-blur-sm">
      <SidebarTrigger className="-ml-1 text-gray-500 transition-colors hover:text-gray-200" />
      <Separator orientation="vertical" className="h-4 bg-[#1E293B]" />

      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-600" />
        <Input
          placeholder="Search models, benchmarks..."
          className="h-8 rounded-md border-[#1E293B]/60 bg-[#111827]/80 pl-9 text-xs text-gray-300 placeholder:text-gray-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[#1E293B] bg-[#0A0F1E] px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
          /
        </kbd>
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1">
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-[#1F2937] hover:text-gray-200"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <Badge
            variant="destructive"
            className="absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-[9px] font-bold"
          >
            3
          </Badge>
        </button>

        <Separator orientation="vertical" className="mx-1 h-4 bg-[#1E293B]" />

        <button
          className="flex h-8 items-center gap-2 rounded-md px-2 text-gray-400 transition-colors hover:bg-[#1F2937] hover:text-gray-200"
          aria-label="User menu"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-[10px] font-bold text-white">
            U
          </div>
          <span className="hidden text-xs font-medium sm:inline">Account</span>
        </button>
      </div>
    </header>
  );
}
