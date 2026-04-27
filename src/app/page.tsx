import Link from "next/link";
import {
  Layers, BarChart3, GitCompareArrows, Trophy,
  ArrowRight, Zap, Shield, Globe,
} from "lucide-react";
import { VendorLogos } from "@/components/marketing/vendor-logos";

const stats = [
  { label: "AI Models", value: "177+" },
  { label: "Benchmarks", value: "18" },
  { label: "Vendors", value: "25+" },
  { label: "Eval Spaces", value: "6" },
];

const features = [
  {
    icon: Layers,
    title: "Explore Models",
    desc: "Browse 177+ models across 25 vendors. Filter by category, pricing, context window.",
  },
  {
    icon: BarChart3,
    title: "Run Evaluations",
    desc: "Benchmark models on standardized tests. Track accuracy, latency, and cost per token.",
  },
  {
    icon: GitCompareArrows,
    title: "Compare Side-by-Side",
    desc: "Pick two models and a benchmark. See exactly where each one wins and loses.",
  },
  {
    icon: Trophy,
    title: "Dynamic Leaderboard",
    desc: "Rank models with adjustable weights. Quality-first, budget pick, or your own formula.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <span className="text-sm font-bold text-white">O</span>
            </div>
            <span className="text-[15px] font-bold tracking-tight text-slate-900">Orbbit</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/dashboard/models" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Models</Link>
            <Link href="/dashboard/leaderboard" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Leaderboard</Link>
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700">
              Open Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-20">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 mb-6">
            <Zap className="h-3 w-3" /> Now tracking 177+ models across 25 vendors
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-slate-900 leading-[1.1]">
            Every model.{" "}
            <span className="text-indigo-600">Measured.</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-500 max-w-xl">
            Independent AI model evaluation you can trust. Compare accuracy, latency, and cost across 177+ models with transparent, reproducible benchmarks.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              Start Exploring <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard/leaderboard"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              View Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-slate-100 bg-slate-50/50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px sm:grid-cols-4 px-6">
          {stats.map((stat) => (
            <div key={stat.label} className="py-8 text-center">
              <p className="text-3xl font-bold tabular-nums text-slate-900">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-2xl font-bold text-slate-900">Built for engineering teams</h2>
          <p className="mt-2 text-sm text-slate-500">Transparent benchmarks. Real data. No marketing fluff.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-md"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust: Vendors */}
      <section className="border-t border-slate-100 bg-slate-50/50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
            Models from leading AI providers
          </p>
          <VendorLogos />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-indigo-600" />
          <Globe className="h-4 w-4 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Know before you deploy.</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
          Stop guessing which model is best for your use case. Evaluate with data, not marketing claims.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          Open Dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600">
              <span className="text-[10px] font-bold text-white">O</span>
            </div>
            <span className="text-xs font-semibold text-slate-500">OrbbitAI</span>
          </div>
          <p className="text-xs text-slate-400">Enterprise AI evaluation you can trust.</p>
        </div>
      </footer>
    </div>
  );
}
