import Link from "next/link";
import { ArrowRight, Terminal, Sliders, CheckCircle2, ShieldCheck, Zap, Sparkles, Layers, BarChart3, GitCompareArrows } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const cookieStore = await (await import("next/headers")).cookies();
  const isGuestDemo = cookieStore.get("orbbit_guest_demo")?.value === "true";
  const isAuthenticated = !!user || isGuestDemo;

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#121316] font-sans selection:bg-zinc-900 selection:text-white">
      
      {/* Floating Architectural Pill Navigation */}
      <header className="sticky top-4 z-50 mx-auto max-w-4xl px-4">
        <nav className="flex h-12 items-center justify-between rounded-full border border-black/8 bg-white/90 px-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-md">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-[11px] font-bold text-white tracking-tight">
              O
            </span>
            <span className="text-xs font-bold tracking-tight text-zinc-900">
              ORBBIT <span className="text-[10px] text-zinc-400 font-mono font-normal">// EVAL OS</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-600">
            <Link href="/dashboard/models" className="hover:text-zinc-950 transition-colors">Models</Link>
            <Link href="/dashboard/leaderboard" className="hover:text-zinc-950 transition-colors">Leaderboard</Link>
            <Link href="/dashboard/compare" className="hover:text-zinc-950 transition-colors">Compare</Link>
            <Link href="/dashboard/spaces" className="hover:text-zinc-950 transition-colors">Spaces</Link>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-colors active:scale-[0.98]"
              >
                Dashboard <ArrowRight className="h-3 w-3" />
              </Link>
            ) : (
              <>
                <Link
                  href="/api/auth/demo"
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-zinc-100/80 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-200/80 transition-colors active:scale-[0.98]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Demo
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-colors active:scale-[0.98]"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-20 text-center md:text-left">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-zinc-100/80 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-600" />
              SYSTEM 01 // INDEPENDENT AI MODEL EVALUATION
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-[-0.04em] text-zinc-900 leading-[1.02]">
              Every model. <br />
              <span className="text-zinc-400">Measured.</span>
            </h1>

            <p className="text-base md:text-lg leading-relaxed text-zinc-600 max-w-xl">
              Don&apos;t pick AI models based on vendor marketing. Orbbit provides rigorous, multi-dimensional evaluations across accuracy, latency, and token cost with 95% Wilson confidence intervals.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/api/auth/demo"
                className="group inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 transition-all active:scale-[0.98]"
              >
                <span>Explore Interactive Demo</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 group-hover:translate-x-0.5 transition-transform">
                  <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
              <Link
                href="/dashboard/leaderboard"
                className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-5 py-3 text-xs font-semibold text-zinc-800 shadow-xs hover:bg-zinc-50 transition-colors active:scale-[0.98]"
              >
                View Live Leaderboard
              </Link>
            </div>
          </div>

          {/* Quick Telemetry & Frontier Leaders Card */}
          <div className="w-full md:w-96 rounded-2xl border border-black/8 bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between border-b border-black/5 pb-3">
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-400 font-semibold">
                FRONTIER BENCHMARK OBSERVATORY
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE SOTA
              </span>
            </div>

            {/* Frontier Models Mini Leaderboard */}
            <div className="space-y-2 font-mono text-xs">
              {[
                { name: "OpenAI: GPT-6 Astra", score: "98.8%", metric: "GSM8K", dot: "bg-zinc-950", rank: "01", tag: "Rank #1" },
                { name: "Anthropic: Claude Fable 5.1", score: "98.4%", metric: "GSM8K", dot: "bg-orange-600", rank: "02", tag: "Reasoning" },
                { name: "DeepSeek: V4.1 Flash", score: "97.8%", metric: "150ms", dot: "bg-indigo-600", rank: "03", tag: "MoE SOTA" },
                { name: "Google: Gemini 3.8 Flash", score: "94.8%", metric: "110ms", dot: "bg-blue-600", rank: "04", tag: "220 TPS" },
                { name: "Qwen: Qwen3.8 Flash", score: "95.2%", metric: "125ms", dot: "bg-teal-600", rank: "05", tag: "Fast Chat" },
              ].map((m) => (
                <div key={m.name} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-black/[0.04] hover:bg-zinc-100 transition-colors">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] text-zinc-400 font-bold w-4">{m.rank}</span>
                    <span className={`h-2 w-2 rounded-full shrink-0 ${m.dot}`} />
                    <span className="text-xs font-bold text-zinc-900 truncate">{m.name}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 shrink-0 ml-2">
                    <span className="text-xs font-extrabold text-zinc-950">{m.score}</span>
                    <span className="text-[9px] text-zinc-400">{m.metric}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-2 border-t border-black/5">
              <span>536+ Models Cataloged</span>
              <Link href="/dashboard/leaderboard" className="text-zinc-900 font-bold hover:underline inline-flex items-center gap-1">
                Full Leaderboard →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Swiss Spec Strip */}
      <section className="border-y border-black/8 bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-2 md:grid-cols-4 divide-x divide-black/8">
          <div className="py-6 px-6 text-center md:text-left">
            <p className="text-2xl font-bold font-mono text-zinc-900">536+</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5 font-medium">Frontier Models</p>
          </div>
          <div className="py-6 px-6 text-center md:text-left">
            <p className="text-2xl font-bold font-mono text-zinc-900">18</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5 font-medium">Standard Suites</p>
          </div>
          <div className="py-6 px-6 text-center md:text-left">
            <p className="text-2xl font-bold font-mono text-zinc-900">Wilson 95%</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5 font-medium">Statistical Rigor</p>
          </div>
          <div className="py-6 px-6 text-center md:text-left">
            <p className="text-2xl font-bold font-mono text-zinc-900">Sub-100ms</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5 font-medium">Latency Tracking</p>
          </div>
        </div>
      </section>

      {/* Asymmetric Swiss Bento Grid */}
      <section className="mx-auto max-w-5xl px-6 py-24 space-y-8">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-[0.2em] font-semibold text-zinc-400">
            SYSTEM CAPABILITIES
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 mt-1">
            Engineered for evidence, not hype.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Bento Card 1: Value Score Engine (Col-Span 2) */}
          <div className="md:col-span-2 rounded-2xl border border-black/8 bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-mono font-bold text-orange-700 uppercase">
                FEATURE 01 // MULTI-CRITERIA
              </span>
              <Sliders className="h-4 w-4 text-zinc-400" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-zinc-900">The Dynamic Value Score™</h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Rankings shouldn&apos;t be static. Adjust weights for Quality, Latency, and Cost. The leaderboard instantly recalculates client-side to match your exact production trade-offs.
              </p>
            </div>

            {/* Fader Mockup */}
            <div className="rounded-xl border border-black/5 bg-[#F9F9F8] p-4 space-y-3 font-mono text-xs">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-zinc-600 font-semibold">QUALITY WEIGHT (Accuracy &amp; Reasoning)</span>
                  <span className="text-zinc-900 font-bold">70%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden">
                  <div className="h-full bg-zinc-900 w-[70%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-zinc-600 font-semibold">COST WEIGHT (Token Unit Economics)</span>
                  <span className="text-zinc-900 font-bold">20%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden">
                  <div className="h-full bg-zinc-900 w-[20%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-zinc-600 font-semibold">SPEED WEIGHT (Latency &amp; TTFT)</span>
                  <span className="text-zinc-900 font-bold">10%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden">
                  <div className="h-full bg-zinc-900 w-[10%]" />
                </div>
              </div>
            </div>
          </div>

          {/* Bento Card 2: Prompt Drilldown (Col-Span 1) */}
          <div className="rounded-2xl border border-black/8 bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-black/8 bg-zinc-100 px-2 py-0.5 text-[10px] font-mono font-bold text-zinc-700 uppercase">
                FEATURE 02 // AUDITABILITY
              </span>
              <h3 className="text-lg font-bold text-zinc-900">Prompt Traceability</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Click into any evaluation run to audit raw model outputs, ground truths, latency in milliseconds, and scorer reasoning.
              </p>
            </div>

            <div className="rounded-xl border border-black/8 bg-zinc-950 p-3 text-[11px] font-mono text-zinc-300 space-y-1.5">
              <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] border-b border-zinc-800 pb-1.5">
                <span className="h-2 w-2 rounded-full bg-zinc-700" />
                <span>TRACE #4192 // MMLU</span>
              </div>
              <p className="text-zinc-400 truncate">Q: Explain Raft quorum...</p>
              <p className="text-emerald-400 font-semibold">✔ Pass (280ms • 64 tokens)</p>
            </div>
          </div>

          {/* Bento Card 3: Wilson Confidence Intervals (Col-Span 1) */}
          <div className="rounded-2xl border border-black/8 bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 uppercase">
                FEATURE 03 // RIGOR
              </span>
              <h3 className="text-lg font-bold text-zinc-900">Wilson 95% Bounds</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                A score without confidence intervals is statistically meaningless. Orbbit calculates 95% Wilson score bounds on every run.
              </p>
            </div>

            <div className="rounded-xl border border-black/5 bg-[#F9F9F8] p-3 text-xs font-mono space-y-1">
              <span className="text-[10px] text-zinc-400 uppercase">Measured Score</span>
              <p className="text-xl font-bold text-zinc-900">88.7%</p>
              <p className="text-[11px] text-zinc-500 font-semibold">95% CI: 85.7% – 91.3%</p>
            </div>
          </div>

          {/* Bento Card 4: BYOD Custom Benchmark (Col-Span 2) */}
          <div className="md:col-span-2 rounded-2xl border border-black/8 bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-700 uppercase">
                FEATURE 04 // ENTERPRISE
              </span>
              <Terminal className="h-4 w-4 text-zinc-400" />
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">Bring Your Own Benchmark (BYOD)</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed max-w-lg">
                  Upload custom CSV or JSON datasets of proprietary company prompts and expected answers. Validate commercial models against your actual production workload.
                </p>
              </div>
              <Link
                href="/dashboard/evaluate"
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-zinc-50 px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 transition-colors shrink-0"
              >
                Try Custom Ingestion →
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/8 bg-white py-12">
        <div className="mx-auto flex max-w-5xl flex-col md:flex-row items-center justify-between gap-4 px-6 text-xs text-zinc-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-zinc-600 font-semibold">ORBBIT // EVALUATION ENGINE</span>
            <span>•</span>
            <span>ALL SYSTEMS OPERATIONAL</span>
          </div>
          <div>
            Built with Next.js 16, Supabase, and OpenRouter
          </div>
        </div>
      </footer>

    </div>
  );
}
