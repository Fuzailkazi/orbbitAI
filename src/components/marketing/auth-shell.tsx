"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  /** Line under the card, e.g. the "create an account" link. */
  footer: ReactNode;
}

/** Shared centered layout for /login and /signup, matching the landing page brand mark. */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-xs">
            O
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground">Orbbit</span>
        </Link>

        <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-8">
          <div className="mb-6 space-y-1 text-center">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">{footer}</p>
      </div>
    </main>
  );
}

/** Divider with a centered caption ("or sign in with email"). */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="relative my-6">
      <div aria-hidden="true" className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-card px-2 text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

interface GuestDemoButtonProps {
  redirectTo: string;
  disabled?: boolean;
  onError: (message: string) => void;
}

/** One-click guest session (sets the demo cookie via /api/auth/demo, then enters the dashboard). */
export function GuestDemoButton({ redirectTo, disabled, onError }: GuestDemoButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function startDemo() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      if (!res.ok) throw new Error(`Demo session failed (${res.status})`);
      router.push(redirectTo);
      router.refresh();
    } catch {
      onError("Couldn't start the guest demo. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={startDemo}
      disabled={disabled || loading}
      className="group h-auto w-full justify-between gap-3 whitespace-normal rounded-xl border-brand/25 bg-brand/5 px-4 py-3 text-left hover:bg-brand/10"
    >
      <span className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
            {loading ? "Starting demo…" : "Explore the live demo"}
          </span>
          <span className="text-xs font-normal text-muted-foreground">No account needed · instant access</span>
        </span>
      </span>
      <ArrowRight className="text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Button>
  );
}
