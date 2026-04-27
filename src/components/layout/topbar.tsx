"use client";

import { Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export function Topbar() {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-[#1E293B] bg-[#111827] px-4">
      <SidebarTrigger className="-ml-1 text-gray-400 hover:text-gray-50" />
      <Separator orientation="vertical" className="h-5 bg-[#1E293B]" />
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <Input
          placeholder="Search models..."
          className="h-9 border-[#1E293B] bg-[#0A0F1E] pl-9 text-sm text-gray-300 placeholder:text-gray-600"
        />
      </div>
      <div className="ml-auto flex items-center gap-3">
        <button className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1F2937] text-gray-400 hover:text-gray-50 transition-colors">
          <User className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
