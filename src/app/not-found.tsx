import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center bg-background px-4 py-16">
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground shadow-2xs">
          O
        </span>
        <span className="text-base font-semibold tracking-tight text-foreground">Orbbit</span>
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-xs sm:p-8">
        <p className="font-mono text-xs font-medium tracking-wide text-muted-foreground">Error 404</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved. Check the URL, or jump back
          into the model catalog and leaderboards.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-4")}>
            <ArrowLeft data-icon="inline-start" />
            Back to home
          </Link>
          <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }), "px-4")}>
            <LayoutDashboard data-icon="inline-start" />
            Open dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
