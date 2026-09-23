"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface RouteErrorProps {
  error: Error & { digest?: string };
  /** Next.js segment reset — re-renders the segment. */
  reset: () => void;
  /** Heading, e.g. "Couldn't load the leaderboard". */
  title?: string;
  /** Supporting copy under the heading. */
  description?: string;
  /** Where the secondary link points. Defaults to /dashboard. */
  backHref?: string;
  backLabel?: string;
  /** `page` centers in the viewport (root error); `section` sits inside the dashboard shell. */
  layout?: "section" | "page";
  className?: string;
}

/**
 * Shared error boundary UI for every `error.tsx` (Architectural invariant 7).
 * Usage in a segment: `export default function Error(props) { return <RouteError {...props} title="…" /> }`
 */
export function RouteError({
  error,
  reset,
  title = "Something went wrong",
  description = "This view failed to load. It may be a temporary network or database issue — try again, or head back and pick another page.",
  backHref = "/dashboard",
  backLabel = "Back to overview",
  layout = "section",
  className,
}: RouteErrorProps) {
  useEffect(() => {
    // Surface the failure in the console / error reporting instead of swallowing it.
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className={cn(
        "flex w-full items-center justify-center px-4",
        layout === "page" ? "min-h-svh py-16" : "py-16 sm:py-24",
        className
      )}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-xs sm:p-8">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="mt-5 text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            Reference <span className="text-foreground/80">{error.digest}</span>
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Link href={backHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-4")}>
            <ArrowLeft data-icon="inline-start" />
            {backLabel}
          </Link>
          <Button size="lg" className="px-4" onClick={() => reset()}>
            <RotateCcw data-icon="inline-start" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
