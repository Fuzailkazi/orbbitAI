"use client";

import { Bell, Search } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm px-4 sm:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="h-8 w-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95 shadow-2xs" />
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search models, benchmarks..."
            className="h-8 w-64 rounded-lg border border-border bg-muted/50 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href="https://github.com/Fuzailkazi/orbbitAI"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
          aria-label="GitHub Repository"
        >
          <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
        </a>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-600" />
        </button>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground hidden sm:inline">OpenRouter connected</span>
        </div>
      </div>
    </header>
  );
}
