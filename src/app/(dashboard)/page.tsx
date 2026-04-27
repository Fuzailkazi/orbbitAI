import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Layers, BookOpen, Play, LayoutGrid, ArrowUpRight, TrendingUp,
  Clock, Zap,
} from "lucide-react";

const stats = [
  {
    label: "Total Models",
    value: "177",
    change: "+12",
    changeLabel: "this month",
    icon: Layers,
    iconColor: "text-indigo-400",
    iconBg: "bg-indigo-500/10",
  },
  {
    label: "Benchmarks",
    value: "18",
    change: "+3",
    changeLabel: "active",
    icon: BookOpen,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
  },
  {
    label: "Evaluations",
    value: "0",
    change: "Ready",
    changeLabel: "to run",
    icon: Play,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10",
  },
  {
    label: "Spaces",
    value: "6",
    change: "All",
    changeLabel: "configured",
    icon: LayoutGrid,
    iconColor: "text-violet-400",
    iconBg: "bg-violet-500/10",
  },
];

const quickActions = [
  { label: "Browse Models", href: "/models", icon: Layers, desc: "Explore 177 AI models across 25+ vendors" },
  { label: "View Leaderboard", href: "/leaderboard", icon: TrendingUp, desc: "Compare models by accuracy, speed, and cost" },
  { label: "Run Evaluation", href: "/evaluations", icon: Zap, desc: "Benchmark a model on standardized tests" },
];

const recentBenchmarks = [
  { name: "MMLU", category: "General", questions: "14,042", method: "Exact Match" },
  { name: "HumanEval", category: "Code", questions: "164", method: "Pass@k" },
  { name: "GSM8K", category: "Math", questions: "8,792", method: "Normalized" },
  { name: "MT-Bench", category: "Chat", questions: "80", method: "LLM Judge" },
  { name: "ARC-Challenge", category: "Reasoning", questions: "2,590", method: "Exact Match" },
];

const categoryColors: Record<string, string> = {
  General: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  Code: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Math: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Chat: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  Reasoning: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-50">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            AI model evaluation at a glance. Every model. Measured.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/5 text-emerald-400">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            System Healthy
          </Badge>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="border-[#1E293B]/60 bg-[#111827]/80 backdrop-blur-sm transition-colors hover:border-[#334155]/60"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-gray-50">
                    {stat.value}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="font-medium text-emerald-400">{stat.change}</span>
                    {stat.changeLabel}
                  </p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.iconBg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <Card className="border-[#1E293B]/60 bg-[#111827]/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action) => (
                <a
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-3 rounded-lg border border-transparent p-3 transition-all hover:border-[#1E293B] hover:bg-[#1F2937]/50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-500/10">
                    <action.icon className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-200">{action.label}</p>
                    <p className="truncate text-xs text-gray-500">{action.desc}</p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-gray-600" />
                </a>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Available Benchmarks */}
        <div className="lg:col-span-3">
          <Card className="border-[#1E293B]/60 bg-[#111827]/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">
                Available Benchmarks
              </CardTitle>
              <a href="/leaderboard" className="text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300">
                View all
              </a>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {/* Table header */}
                <div className="grid grid-cols-4 gap-4 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-gray-600">
                  <span>Name</span>
                  <span>Category</span>
                  <span className="text-right">Questions</span>
                  <span className="text-right">Scoring</span>
                </div>
                {/* Table rows */}
                {recentBenchmarks.map((benchmark) => (
                  <div
                    key={benchmark.name}
                    className="grid grid-cols-4 items-center gap-4 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-[#1F2937]/50"
                  >
                    <span className="font-medium text-gray-200">{benchmark.name}</span>
                    <span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-medium ${categoryColors[benchmark.category] ?? "text-gray-400"}`}
                      >
                        {benchmark.category}
                      </Badge>
                    </span>
                    <span className="text-right font-mono text-xs text-gray-400">
                      {benchmark.questions}
                    </span>
                    <span className="text-right text-xs text-gray-500">
                      {benchmark.method}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer note */}
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <Clock className="h-3 w-3" />
        <span>Data refreshed from Supabase. Evaluations run via async job queue.</span>
      </div>
    </div>
  );
}
