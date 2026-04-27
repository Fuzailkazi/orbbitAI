"use client";

import { Bell, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Overview</h2>
        <p className="text-[11px] text-slate-500">Key metrics of AI model performance.</p>
      </div>
      <div className="flex items-center gap-2">
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Reports">
          <FileText className="h-4 w-4" />
        </button>
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-indigo-600" />
        </button>
        <Separator orientation="vertical" className="mx-1 h-4 bg-slate-200" />
        <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50" aria-label="Account">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">U</div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-medium text-slate-700">User</p>
            <p className="text-[10px] text-slate-400">Administrator</p>
          </div>
        </button>
      </div>
    </header>
  );
}
