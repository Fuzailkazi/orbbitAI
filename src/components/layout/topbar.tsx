"use client";

import { Bell, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/[0.08] bg-[#FBFBFA]/95 backdrop-blur-md px-6 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-mono font-bold tracking-tight text-zinc-950 uppercase">
              ORBBIT LAB // NODE 01
            </h2>
            <span className="text-[10px] font-mono text-zinc-400">•</span>
            <span className="text-[11px] font-mono text-zinc-600 hidden sm:inline">
              Wilson 95% CI Engine
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono hidden md:block">
            Empirical LLM Benchmarking, Telemetry Tracing & Pareto Scoring
          </p>
        </div>
        <div className="hidden md:flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-2.5 py-0.5 text-[10px] font-mono font-medium text-zinc-800 shadow-2xs">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>RUNNER ONLINE</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href="https://github.com/Fuzailkazi/orbbitAI"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/[0.08] bg-white text-zinc-500 transition-all hover:bg-zinc-50 hover:text-zinc-950 shadow-2xs active:scale-95"
          aria-label="Documentation"
        >
          <FileText className="h-4 w-4" />
        </a>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-black/[0.08] bg-white text-zinc-500 transition-all hover:bg-zinc-50 hover:text-zinc-950 shadow-2xs active:scale-95"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-orange-600" />
        </button>
        <Separator orientation="vertical" className="mx-1 h-4 bg-black/[0.08]" />
        <div className="flex items-center gap-2.5 rounded-lg border border-black/[0.08] bg-white px-2.5 py-1 text-left shadow-2xs">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-950 text-[10px] font-mono font-bold text-white shadow-2xs">
            01
          </div>
          <div className="hidden sm:block">
            <p className="text-[11px] font-mono font-medium text-zinc-900 leading-tight">OPENROUTER</p>
            <p className="text-[9px] text-zinc-400 leading-tight font-mono">177+ MODELS</p>
          </div>
        </div>
      </div>
    </header>
  );
}
