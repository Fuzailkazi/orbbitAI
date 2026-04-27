import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Layers, BookOpen, Play, ArrowUpRight,
  Zap, Clock, Info,
} from "lucide-react";

const stats = [
  {
    label: "Total Models",
    value: "177",
    change: "+12.3%",
    trend: "up" as const,
    footer: "Across 25+ vendors",
    icon: Layers,
  },
  {
    label: "Benchmarks",
    value: "18",
    change: "+3",
    trend: "up" as const,
    footer: "Active test suites",
    icon: BookOpen,
  },
  {
    label: "Evaluations",
    value: "0",
    change: "Ready",
    trend: "neutral" as const,
    footer: "Run your first eval",
    icon: Play,
  },
];

const topVendors = [
  { name: "OpenAI", models: 15, share: "40%" },
  { name: "Google", models: 17, share: "30%" },
  { name: "Meta", models: 13, share: "20%" },
  { name: "Mistral", models: 12, share: "10%" },
];

const vendorColors = ["bg-indigo-500", "bg-indigo-400", "bg-indigo-300", "bg-indigo-200"];

const benchmarks = [
  { name: "MMLU", category: "General", questions: "14,042", method: "Exact Match" },
  { name: "HumanEval", category: "Code", questions: "164", method: "Pass@k" },
  { name: "GSM8K", category: "Math", questions: "8,792", method: "Normalized" },
  { name: "MT-Bench", category: "Chat", questions: "80", method: "LLM Judge" },
  { name: "ARC-Challenge", category: "Reasoning", questions: "2,590", method: "Exact Match" },
  { name: "GPQA", category: "Science", questions: "448", method: "Exact Match" },
];

const catColors: Record<string, string> = {
  General: "bg-indigo-50 text-indigo-600",
  Code: "bg-emerald-50 text-emerald-600",
  Math: "bg-amber-50 text-amber-600",
  Chat: "bg-pink-50 text-pink-600",
  Reasoning: "bg-violet-50 text-violet-600",
  Science: "bg-cyan-50 text-cyan-600",
};

const spaces = [
  { name: "Mathematics", benchmarks: 2, icon: "📐", color: "bg-amber-50 border-amber-200" },
  { name: "Code Generation", benchmarks: 3, icon: "💻", color: "bg-emerald-50 border-emerald-200" },
  { name: "Reasoning", benchmarks: 5, icon: "🧠", color: "bg-violet-50 border-violet-200" },
  { name: "Chat Quality", benchmarks: 3, icon: "💬", color: "bg-pink-50 border-pink-200" },
  { name: "Factuality", benchmarks: 2, icon: "✓", color: "bg-cyan-50 border-cyan-200" },
  { name: "Agentic", benchmarks: 3, icon: "⚡", color: "bg-indigo-50 border-indigo-200" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Stat Cards - 3 columns */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                {stat.trend === "up" && (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold">
                    <ArrowUpRight className="mr-0.5 h-3 w-3" />
                    {stat.change}
                  </Badge>
                )}
                {stat.trend === "neutral" && (
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500 text-xs">
                    {stat.change}
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                {stat.value}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <Info className="h-3 w-3" />
                <span>{stat.footer}</span>
                <button className="ml-auto rounded border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50">
                  View Details
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content — 2 columns */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Benchmarks table — 2/3 width */}
        <Card className="border-slate-200 bg-white shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-slate-400" />
              <CardTitle className="text-sm font-semibold text-slate-900">Available Benchmarks</CardTitle>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 text-xs">
              <button className="rounded-md bg-white px-3 py-1 font-medium text-slate-900 shadow-sm">All</button>
              <button className="rounded-md px-3 py-1 text-slate-500 hover:text-slate-700">Code</button>
              <button className="rounded-md px-3 py-1 text-slate-500 hover:text-slate-700">Math</button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {/* Header */}
              <div className="grid grid-cols-4 gap-4 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <span>Benchmark</span>
                <span>Category</span>
                <span className="text-right">Questions</span>
                <span className="text-right">Scoring</span>
              </div>
              {/* Rows */}
              {benchmarks.map((b) => (
                <div key={b.name} className="grid grid-cols-4 items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-slate-50">
                  <span className="font-medium text-slate-800">{b.name}</span>
                  <span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${catColors[b.category] ?? "bg-slate-100 text-slate-600"}`}>
                      {b.category}
                    </span>
                  </span>
                  <span className="text-right font-mono text-xs text-slate-500">{b.questions}</span>
                  <span className="text-right text-xs text-slate-400">{b.method}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right column — Vendors + Spaces */}
        <div className="space-y-6">
          {/* Top Vendors */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="px-5 py-4">
              <CardTitle className="text-sm font-semibold text-slate-900">Top Vendors</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {/* Bar visualization */}
              <div className="mb-4 flex h-2.5 overflow-hidden rounded-full">
                {topVendors.map((v, i) => (
                  <div key={v.name} className={`${vendorColors[i]} transition-all`} style={{ width: v.share }} />
                ))}
              </div>
              <div className="space-y-2.5">
                {topVendors.map((v, i) => (
                  <div key={v.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${vendorColors[i]}`} />
                      <span className="text-slate-700">{v.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-slate-500">{v.models}</span>
                      <span className="w-8 text-right text-xs font-semibold text-indigo-600">{v.share}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Spaces */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
              <CardTitle className="text-sm font-semibold text-slate-900">Eval Spaces</CardTitle>
              <a href="/spaces" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View All</a>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 px-5 pb-5">
              {spaces.map((s) => (
                <div key={s.name} className={`rounded-lg border p-3 transition-colors hover:shadow-sm ${s.color}`}>
                  <p className="text-xs font-semibold text-slate-800">{s.name}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{s.benchmarks} benchmarks</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions bar */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="flex items-center gap-4 p-4">
          <Clock className="h-4 w-4 text-slate-400" />
          <p className="text-xs text-slate-500">Ready to evaluate? Choose a model and benchmark to run your first evaluation.</p>
          <div className="ml-auto flex gap-2">
            <a href="/models" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
              <Layers className="h-3.5 w-3.5" /> Browse Models
            </a>
            <a href="/evaluations" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-700">
              <Zap className="h-3.5 w-3.5" /> Run Evaluation
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
