import Link from "next/link";
import { Activity, ArrowRight, Layers, ShieldCheck, Sparkles, Zap, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { AuthAware } from "./auth-aware";
import { BenchmarkArena } from "./benchmark-arena";
import { HeroBoardCard } from "./hero-board-card";
import { MobileNav } from "./mobile-nav";
import { ScorerInspector } from "./scorer-inspector";
import { NAV_LINKS } from "./shared";
import type { LandingShowcase, LandingStats } from "./types";

/** Shown instead of scores when there are no completed evaluations (or the database is unreachable). */
function ShowcaseEmpty({ status, compact = false }: { status: LandingShowcase["status"]; compact?: boolean }) {
  const unavailable = status === "unavailable";
  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-2.5 rounded-2xl border border-dashed border-border bg-muted/30 ${
        compact ? "px-4 py-8" : "px-6 py-12"
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
        <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-foreground">
        {unavailable ? "Live results are temporarily unavailable" : "No completed evaluations yet"}
      </p>
      <p className="text-xs text-muted-foreground max-w-[42ch] leading-relaxed">
        {unavailable
          ? "We couldn't reach the results database. Scores are only ever shown from recorded evaluations, so nothing is displayed until it's back."
          : "Scores appear here as soon as evaluations complete, each with its Wilson 95% CI and a drill-down to every graded prompt."}
      </p>
      <AuthAware
        authed={
          <Link
            href="/dashboard/evaluate"
            className="mt-1 text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
          >
            <span>Run an evaluation</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        }
        guest={
          <Link
            href="/api/auth/demo"
            prefetch={false}
            className="mt-1 text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
          >
            <span>Explore the demo</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        }
      />
    </div>
  );
}

/**
 * The landing page, server-rendered. Only the hero board switcher, the benchmark arena, the scorer
 * inspector and the mobile menu hydrate; auth-dependent calls to action stream in via AuthAware.
 * Entrance animations are CSS keyframes (landing-motion.css), so content animates from first paint.
 */
export function LandingView({ stats, showcase }: { stats: LandingStats; showcase: LandingShowcase }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans selection:bg-brand selection:text-brand-foreground relative overflow-hidden">
      
      {/* Subtle Atmospheric Ambient Glow */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div 
          style={{
            clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)'
          }} 
          className="relative left-[calc(50%-11rem)] aspect-1155/678 w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-linear-to-tr from-brand/10 to-brand/5 opacity-60 sm:left-[calc(50%-20rem)] sm:w-[68rem]"
        />
      </div>

      {/* Floating Pill Nav */}
      <header className="sticky top-4 z-50 mx-auto max-w-5xl px-4 sm:px-6">
        <nav aria-label="Primary" className="flex h-14 items-center justify-between gap-3 rounded-full border border-border bg-card/90 pl-4 pr-2 sm:px-5 shadow-xs backdrop-blur-md">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tracking-tight shadow-xs">
              O
            </span>
            <span className="text-base font-bold tracking-tight text-foreground">
              Orbbit
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
              Observatory
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-foreground transition-colors">
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <AuthAware
              authed={
                <Link
                  href="/dashboard"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-95 transition-all active:scale-[0.98]"
                >
                  <span>Dashboard</span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground/20 transition-transform duration-200 group-hover:translate-x-0.5">
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              }
              guest={
                <>
                  <Link
                    href="/api/auth/demo" prefetch={false}
                    className="hidden sm:inline-flex items-center justify-center rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors active:scale-[0.98] shadow-2xs"
                  >
                    Try demo
                  </Link>
                  <Link
                    href="/login"
                    className="group inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-95 transition-all active:scale-[0.98]"
                  >
                    <span>Sign in</span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground/20 transition-transform duration-200 group-hover:translate-x-0.5">
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                </>
              }
            />

            {/* Compact menu for < md, where the section links are hidden */}
            <MobileNav
              cta={
                <AuthAware
                  authed={
                    <Link
                      href="/dashboard"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                    >
                      Open dashboard
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  }
                  guest={
                    <>
                      <Link
                        href="/api/auth/demo" prefetch={false}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                      >
                        <Sparkles className="h-4 w-4" />
                        Try the demo
                      </Link>
                      <Link
                        href="/login"
                        className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card text-sm font-medium text-foreground hover:bg-muted"
                      >
                        Sign in
                      </Link>
                    </>
                  }
                />
              }
            />
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-16 md:pt-20 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text */}
          <div className="lg:col-span-7 space-y-6">
            <div
              className="animate-[landing-rise_0.5s_cubic-bezier(0.16,1,0.3,1)_both] inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3.5 py-1 text-xs font-semibold text-brand"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              <span>Independent Frontier AI Benchmark Observatory</span>
            </div>

            <h1
              className="animate-[landing-rise_0.5s_cubic-bezier(0.16,1,0.3,1)_80ms_both] text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.12]"
            >
              Compare AI models with standardized benchmarks
            </h1>

            <p
              className="animate-[landing-rise_0.5s_cubic-bezier(0.16,1,0.3,1)_160ms_both] text-base sm:text-lg text-muted-foreground max-w-[56ch] leading-relaxed"
            >
              Track {stats.models ? formatNumber(stats.models) : "hundreds of"} frontier & open-weight models and compare recorded evaluations. Balance measured task accuracy, token cost economics, and latency with calibrated Wilson 95% confidence bounds.
            </p>

            <div
              className="animate-[landing-rise_0.5s_cubic-bezier(0.16,1,0.3,1)_240ms_both] flex flex-wrap items-center gap-3.5 pt-2"
            >
              <Link
                href="/api/auth/demo" prefetch={false}
                className="group inline-flex items-center gap-2.5 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95 transition-all active:scale-[0.98]"
              >
                <span>Explore Interactive Demo</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-foreground/20 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
              <a
                href="#comparison"
                className="group inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-6 py-3 text-sm font-medium text-foreground hover:bg-muted transition-all active:scale-[0.98] shadow-2xs"
              >
                <span>View Benchmark Arena</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted transition-transform duration-200 group-hover:translate-x-0.5">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </a>
            </div>

            {/* Quick Metrics Ticker */}
            <div
              className="animate-[landing-fade_0.5s_ease-out_320ms_both] flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-6 pt-4 border-t border-border text-xs text-muted-foreground"
            >
              {stats.models ? (
                <>
                  <div className="whitespace-nowrap">
                    <span className="font-bold text-foreground font-mono tabular-nums">{formatNumber(stats.models)}</span> models tracked
                  </div>
                  <div aria-hidden="true" className="hidden sm:block h-3 w-px bg-border" />
                </>
              ) : null}
              {stats.benchmarks ? (
                <>
                  <div className="whitespace-nowrap">
                    <span className="font-bold text-foreground font-mono tabular-nums">{formatNumber(stats.benchmarks)}</span> benchmark suites
                  </div>
                  <div aria-hidden="true" className="hidden sm:block h-3 w-px bg-border" />
                </>
              ) : null}
              <div className="whitespace-nowrap">
                <span className="font-bold text-foreground font-mono">95%</span> Wilson CIs
              </div>
            </div>
          </div>

          {/* Right Hero Interactive Board Card */}
          <div className="lg:col-span-5 animate-[landing-pop_0.6s_cubic-bezier(0.16,1,0.3,1)_0.2s_both]">
            <HeroBoardCard
              boards={showcase.heroBoards}
              empty={showcase.heroBoards.length ? null : <ShowcaseEmpty status={showcase.status} compact />}
              footerLink={
                <AuthAware
                  authed={
                    <Link
                      href="/dashboard/leaderboard"
                      className="font-semibold text-brand hover:underline inline-flex items-center gap-1"
                    >
                      <span>Full Leaderboard</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  }
                  guest={
                    <Link
                      href="/docs#overview"
                      className="font-semibold text-brand hover:underline inline-flex items-center gap-1"
                    >
                      <span>Explore Documentation</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  }
                />
              }
            />
          </div>
        </div>
      </section>

      {/* SECTION: THE BENCHMARKING ARENA (Interactive Showcase) */}
      <section id="comparison" className="mx-auto max-w-6xl px-4 sm:px-6 py-12 md:py-16">
        <BenchmarkArena matchups={showcase.matchups} empty={showcase.matchups.length ? null : <ShowcaseEmpty status={showcase.status} />} />
      </section>

      {/* SECTION: SCORER METHODOLOGIES (Interactive Inspector) */}
      <section id="methodology" className="mx-auto max-w-6xl px-4 sm:px-6 py-12 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-3 py-1 rounded-full border border-border">
            Evaluation Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-3">
            Deterministic Scoring Engines & Statistical Bounds
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Orbbit tests models across multiple cognitive and engineering dimensions with strict automated scoring harnesses.
          </p>
        </div>

        <ScorerInspector avgCiHalfWidth={stats.avgCiHalfWidth} />
      </section>

      {/* SECTION: CAPABILITIES BENTO GRID */}
      <section id="features" className="mx-auto max-w-6xl px-4 sm:px-6 py-12 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-3 py-1 rounded-full border border-border">
            Platform Capabilities
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-3">
            Designed for Rigorous Decision-Making
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-5 w-5 text-brand" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pareto Decision Matrix</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Dynamic Value Score™ Ranking</h3>
              <p className="text-sm text-muted-foreground max-w-[50ch] leading-relaxed">
                A multi-criteria ranking that balances accuracy, cost, and speed. Adjust priorities to match your production needs and instantly recalculate rankings.
              </p>
            </div>
            <div className="pt-6">
              <Link href="/dashboard/leaderboard" className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1">
                Configure weight sliders in leaderboard →
              </Link>
            </div>
          </div>

          <div className="md:col-span-1 bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-5 w-5 text-brand" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Auditability</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Prompt Traceability</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Trace every evaluation back to its source prompt. Audit raw outputs, truth bounds, and execution latency.
              </p>
            </div>
            <div className="pt-6">
              <Link href="/dashboard/evaluations" className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1">
                Inspect recorded traces →
              </Link>
            </div>
          </div>

          <div className="md:col-span-1 bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-brand" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statistical Bounds</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Wilson 95% Confidence</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Wilson 95% confidence intervals on all results, ensuring you make choices based on reliable empirical data.
              </p>
            </div>
            <div className="pt-6">
              <Link href="/dashboard/leaderboard" className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1">
                View confidence intervals →
              </Link>
            </div>
          </div>

          <div className="md:col-span-2 bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-5 w-5 text-brand" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom Evaluation</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Custom Benchmarks (BYOD)</h3>
              <p className="text-sm text-muted-foreground max-w-[50ch] leading-relaxed">
                Bring your own evaluation suites to test models against your domain-specific problems and proprietary workloads via CSV or JSON.
              </p>
            </div>
            <div className="pt-6">
              <Link href="/dashboard/evaluate" className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1">
                Upload benchmark & test →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* High-Contrast Footer */}
      <footer className="mx-auto max-w-6xl px-4 sm:px-6 py-12 border-t border-border mt-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                O
              </span>
              <span className="text-sm font-bold text-foreground">Orbbit AI</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Independent AI model evaluation platform with Wilson 95% statistical rigor.
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            <p className="font-semibold text-foreground">Observatory</p>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="/dashboard" className="hover:text-foreground">Overview</Link></li>
              <li><Link href="/dashboard/leaderboard" className="hover:text-foreground">Leaderboard</Link></li>
              <li><Link href="/dashboard/models" className="hover:text-foreground">Models Catalog</Link></li>
              <li><Link href="/dashboard/compare" className="hover:text-foreground">Head-to-Head</Link></li>
            </ul>
          </div>

          <div className="space-y-2.5 text-xs">
            <p className="font-semibold text-foreground">Testing Suites</p>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="/dashboard/leaderboard?benchmark=MMLU" className="hover:text-foreground">MMLU</Link></li>
              <li><Link href="/dashboard/leaderboard?benchmark=HumanEval" className="hover:text-foreground">HumanEval</Link></li>
              <li><Link href="/dashboard/leaderboard?benchmark=GSM8K" className="hover:text-foreground">GSM8K</Link></li>
              <li><Link href="/dashboard/leaderboard?benchmark=MATH" className="hover:text-foreground">MATH</Link></li>
            </ul>
          </div>

          <div className="space-y-2.5 text-xs">
            <p className="font-semibold text-foreground">Resources</p>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="/docs" className="hover:text-foreground">Documentation</Link></li>
              <li><a href="https://github.com/Fuzailkazi/orbbitAI" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">GitHub</a></li>
              <li><Link href="/api/auth/demo" prefetch={false} className="hover:text-foreground">Interactive Demo</Link></li>
              <li><Link href="/login" className="hover:text-foreground">Sign In</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© 2026 Orbbit. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Wilson 95% CI Verified</span>
            <span>OpenRouter Gateway</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
