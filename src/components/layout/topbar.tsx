"use client";

import { type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const iconButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-2xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

function TopbarSearch() {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    router.push(q ? `/dashboard/models?q=${encodeURIComponent(q)}` : "/dashboard/models");
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="relative hidden items-center md:flex">
      <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <input
        type="search"
        name="q"
        placeholder="Search models…"
        aria-label="Search models"
        autoComplete="off"
        className="h-8 w-64 rounded-lg border border-border bg-muted/50 pl-8 pr-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/20 lg:w-72"
      />
    </form>
  );
}

function OpenRouterStatus({ configured }: { configured: boolean }) {
  const title = configured
    ? "OPENROUTER_API_KEY is configured on the server. Live evaluations run on :free models."
    : "OPENROUTER_API_KEY is not set on the server. Live evaluations are unavailable; results of past runs are still browsable.";

  return (
    <div
      title={title}
      className="flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-2.5 shadow-2xs"
    >
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", configured ? "bg-success" : "bg-warning")}
      />
      <span className="text-xs text-muted-foreground">
        OpenRouter
        <span className="hidden sm:inline">{configured ? " configured" : " not configured"}</span>
        <span className="sr-only sm:hidden">{configured ? " configured" : " not configured"}</span>
      </span>
    </div>
  );
}

export function Topbar({ openRouterConfigured }: { openRouterConfigured: boolean }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className={cn(iconButton, "active:scale-95")} />
        {/* Brand mark on mobile, where the sidebar (and its logo) lives in a sheet */}
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2 md:hidden" aria-label="Orbbit overview">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-xs font-semibold text-background">
            O
          </span>
          <span className="truncate text-sm font-semibold tracking-tight text-foreground">Orbbit</span>
        </Link>
        <TopbarSearch />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/dashboard/models" className={cn(iconButton, "md:hidden")} aria-label="Search models">
          <Search className="h-4 w-4" />
        </Link>
        <a
          href="https://github.com/Fuzailkazi/orbbitAI"
          target="_blank"
          rel="noopener noreferrer"
          className={iconButton}
          aria-label="GitHub repository"
        >
          <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden>
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
        </a>
        <Separator orientation="vertical" className="mx-1 hidden h-4 sm:block" />
        <OpenRouterStatus configured={openRouterConfigured} />
      </div>
    </header>
  );
}
