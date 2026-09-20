"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Sparkles, Activity, ShieldCheck,
  Layers, GitCompare, Zap, Trophy, BarChart3, Database,
  Cpu, Code2, ChevronRight, CheckCircle2, Terminal, Percent,
  Scale, Filter
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LandingClientProps {
  isAuthenticated: boolean;
}

interface BenchmarkItem {
  name: string;
  category: "Knowledge" | "Code" | "Math" | "Reasoning";
  scoreA: number;
  scoreB: number;
  winner: "A" | "B" | "tie";
  delta: string;
  description: string;
}

interface Matchup {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  modelA: { name: string; shortName: string; lab: string; color: string; badge: string };
  modelB: { name: string; shortName: string; lab: string; color: string; badge: string };
  specs: {
    latencyA: string;
    latencyB: string;
    costA: string;
    costB: string;
    contextA: string;
    contextB: string;
    throughputA: string;
    throughputB: string;
  };
  benchmarks: BenchmarkItem[];
}

const MATCHUPS: Matchup[] = [
  {
    id: "astra-vs-fable",
    title: "OpenAI GPT-6 Astra vs Claude Fable 5.1",
    subtitle: "Frontier Flagship Reasoning & Autonomous Engineering",
    badge: "Frontier Flagships",
    modelA: {
      name: "OpenAI GPT-6 Astra",
      shortName: "GPT-6 Astra",
      lab: "OpenAI",
      color: "#171717",
      badge: "SOTA Leader",
    },
    modelB: {
      name: "Claude Fable 5.1",
      shortName: "Claude Fable",
      lab: "Anthropic",
      color: "#EA580C",
      badge: "Top Coding",
    },
    specs: {
      latencyA: "185ms P50",
      latencyB: "210ms P50",
      costA: "$1.25 / 1M",
      costB: "$1.50 / 1M",
      contextA: "1.0M tokens",
      contextB: "500K tokens",
      throughputA: "84 tok/s",
      throughputB: "78 tok/s",
    },
    benchmarks: [
      { name: "MMLU", category: "Knowledge", scoreA: 98.8, scoreB: 98.4, winner: "A", delta: "+0.4% Astra", description: "57 subjects in STEM, humanities & social sciences" },
      { name: "HumanEval", category: "Code", scoreA: 96.5, scoreB: 98.4, winner: "B", delta: "+1.9% Fable", description: "Python code synthesis verified against unit tests" },
      { name: "GSM8K", category: "Math", scoreA: 99.1, scoreB: 98.6, winner: "A", delta: "+0.5% Astra", description: "Multi-step grade school arithmetic word problems" },
      { name: "MATH", category: "Math", scoreA: 96.8, scoreB: 97.2, winner: "B", delta: "+0.4% Fable", description: "High school competition math & LaTeX parsing" },
      { name: "ARC-Challenge", category: "Reasoning", scoreA: 98.4, scoreB: 97.9, winner: "A", delta: "+0.5% Astra", description: "Complex science reasoning questions with hard distractors" },
      { name: "GPQA", category: "Reasoning", scoreA: 82.5, scoreB: 84.2, winner: "B", delta: "+1.7% Fable", description: "Graduate-level physics, chemistry, and biology" },
    ],
  },
  {
    id: "deepseek-vs-gemini",
    title: "DeepSeek V4.1 Flash vs Gemini 3.8 Flash",
    subtitle: "High-Throughput Sub-100ms Inference & Low-Cost Flagship Tier",
    badge: "Efficiency Speedsters",
    modelA: {
      name: "DeepSeek V4.1 Flash",
      shortName: "DeepSeek V4.1",
      lab: "DeepSeek",
      color: "#6366F1",
      badge: "Cost Champion",
    },
    modelB: {
      name: "Gemini 3.8 Flash",
      shortName: "Gemini 3.8",
      lab: "Google DeepMind",
      color: "#2563EB",
      badge: "Speed Leader",
    },
    specs: {
      latencyA: "95ms P50",
      latencyB: "85ms P50",
      costA: "$0.14 / 1M",
      costB: "$0.10 / 1M",
      contextA: "128K tokens",
      contextB: "1.0M tokens",
      throughputA: "142 tok/s",
      throughputB: "165 tok/s",
    },
    benchmarks: [
      { name: "MMLU", category: "Knowledge", scoreA: 97.8, scoreB: 94.8, winner: "A", delta: "+3.0% DeepSeek", description: "57 subjects in STEM, humanities & social sciences" },
      { name: "HumanEval", category: "Code", scoreA: 95.8, scoreB: 92.4, winner: "A", delta: "+3.4% DeepSeek", description: "Python code synthesis verified against unit tests" },
      { name: "GSM8K", category: "Math", scoreA: 98.2, scoreB: 96.8, winner: "A", delta: "+1.4% DeepSeek", description: "Multi-step grade school arithmetic word problems" },
      { name: "MATH", category: "Math", scoreA: 97.8, scoreB: 91.2, winner: "A", delta: "+6.6% DeepSeek", description: "High school competition math & LaTeX parsing" },
      { name: "ARC-Challenge", category: "Reasoning", scoreA: 97.2, scoreB: 96.0, winner: "A", delta: "+1.2% DeepSeek", description: "Complex science reasoning questions with hard distractors" },
      { name: "GPQA", category: "Reasoning", scoreA: 79.4, scoreB: 80.2, winner: "B", delta: "+0.8% Gemini", description: "Graduate-level physics, chemistry, and biology" },
    ],
  },
  {
    id: "sonnet-vs-gpt4o",
    title: "Claude 3.5 Sonnet vs OpenAI GPT-4o",
    subtitle: "Established Enterprise Production Standard Baseline",
    badge: "Production Baselines",
    modelA: {
      name: "Claude 3.5 Sonnet",
      shortName: "Sonnet 3.5",
      lab: "Anthropic",
      color: "#EA580C",
      badge: "Industry Standard",
    },
    modelB: {
      name: "OpenAI GPT-4o",
      shortName: "GPT-4o",
      lab: "OpenAI",
      color: "#171717",
      badge: "Multimodal Core",
    },
    specs: {
      latencyA: "260ms P50",
      latencyB: "320ms P50",
      costA: "$3.00 / 1M",
      costB: "$2.50 / 1M",
      contextA: "200K tokens",
      contextB: "128K tokens",
      throughputA: "72 tok/s",
      throughputB: "68 tok/s",
    },
    benchmarks: [
      { name: "MMLU", category: "Knowledge", scoreA: 88.7, scoreB: 88.7, winner: "tie", delta: "Tie (88.7%)", description: "57 subjects in STEM, humanities & social sciences" },
      { name: "HumanEval", category: "Code", scoreA: 92.0, scoreB: 90.2, winner: "A", delta: "+1.8% Sonnet", description: "Python code synthesis verified against unit tests" },
      { name: "GSM8K", category: "Math", scoreA: 96.4, scoreB: 95.8, winner: "A", delta: "+0.6% Sonnet", description: "Multi-step grade school arithmetic word problems" },
      { name: "MATH", category: "Math", scoreA: 78.3, scoreB: 76.6, winner: "A", delta: "+1.7% Sonnet", description: "High school competition math & LaTeX parsing" },
      { name: "ARC-Challenge", category: "Reasoning", scoreA: 96.8, scoreB: 96.3, winner: "A", delta: "+0.5% Sonnet", description: "Complex science reasoning questions with hard distractors" },
      { name: "GPQA", category: "Reasoning", scoreA: 65.4, scoreB: 53.6, winner: "A", delta: "+11.8% Sonnet", description: "Graduate-level physics, chemistry, and biology" },
    ],
  },
  {
    id: "llama-vs-qwen",
    title: "Meta Llama 4 Maverick vs Qwen 3.8 72B",
    subtitle: "Open Weights Frontier Architecture Battle",
    badge: "Open Weights",
    modelA: {
      name: "Meta Llama 4 Maverick",
      shortName: "Llama 4",
      lab: "Meta AI",
      color: "#0284C7",
      badge: "Open Frontier",
    },
    modelB: {
      name: "Qwen 3.8 72B Instruct",
      shortName: "Qwen 3.8",
      lab: "Alibaba",
      color: "#0D9488",
      badge: "Math & Code SOTA",
    },
    specs: {
      latencyA: "135ms P50",
      latencyB: "145ms P50",
      costA: "$0.30 / 1M (Host)",
      costB: "$0.35 / 1M (Host)",
      contextA: "256K tokens",
      contextB: "128K tokens",
      throughputA: "115 tok/s",
      throughputB: "105 tok/s",
    },
    benchmarks: [
      { name: "MMLU", category: "Knowledge", scoreA: 94.6, scoreB: 95.2, winner: "B", delta: "+0.6% Qwen", description: "57 subjects in STEM, humanities & social sciences" },
      { name: "HumanEval", category: "Code", scoreA: 91.4, scoreB: 94.8, winner: "B", delta: "+3.4% Qwen", description: "Python code synthesis verified against unit tests" },
      { name: "GSM8K", category: "Math", scoreA: 96.2, scoreB: 97.5, winner: "B", delta: "+1.3% Qwen", description: "Multi-step grade school arithmetic word problems" },
      { name: "MATH", category: "Math", scoreA: 88.4, scoreB: 92.1, winner: "B", delta: "+3.7% Qwen", description: "High school competition math & LaTeX parsing" },
      { name: "ARC-Challenge", category: "Reasoning", scoreA: 95.6, scoreB: 94.9, winner: "A", delta: "+0.7% Llama", description: "Complex science reasoning questions with hard distractors" },
      { name: "GPQA", category: "Reasoning", scoreA: 72.8, scoreB: 74.5, winner: "B", delta: "+1.7% Qwen", description: "Graduate-level physics, chemistry, and biology" },
    ],
  },
];

const SCORER_METHODS = [
  {
    id: "exact-match",
    name: "Exact Match Scorer",
    badge: "Deterministic",
    icon: CheckCircle2,
    desc: "Rigorous regex extraction of multiple-choice answers (A, B, C, D) ignoring leading reasoning or verbose conversational framing.",
    code: `// ExactMatchScorer execution:
const clean = response.trim().toUpperCase();
const regex = /(?:ANSWER IS|CORRECT OPTION:?)\\s*([A-D])/i;
return match[1] === expectedAnswer;`,
    testRate: "100% Deterministic",
  },
  {
    id: "code-sandbox",
    name: "Sandboxed Code Execution",
    badge: "Unit Tested",
    icon: Terminal,
    desc: "Executes model-generated Python snippets inside an isolated container harness against unseen unit assertions with strict timeout limits.",
    code: `// Code Execution Harness:
def check(candidate):
    assert candidate([1, 2, 3]) == [3, 2, 1]
    assert candidate([]) == []
    return True`,
    testRate: "Pyodide / Docker Isolated",
  },
  {
    id: "normalized-scorer",
    name: "Normalized Math Scorer",
    badge: "LaTeX & Delimiters",
    icon: Percent,
    desc: "Extracts final numeric answers from GSM8K (#### delimiter) and complex algebraic answers from MATH (\\boxed{} expressions).",
    code: `// Normalized Scorer:
const gsmMatch = response.match(/####\\s*(-?[0-9,.]+)/);
const latexMatch = response.match(/\\\\boxed\\{([^}]+)\\}/);
return normalize(gsmMatch[1]) === expected;`,
    testRate: "LaTeX & Currency Safe",
  },
  {
    id: "wilson-interval",
    name: "Wilson 95% Confidence Bounds",
    badge: "Statistical Rigor",
    icon: Scale,
    desc: "Computes asymmetric binomial confidence intervals. Guarantees that small-sample anomalies do not falsify leaderboard rankings.",
    code: `// Wilson Score Interval (95% CI):
const z = 1.95996; // 95% standard score
const p_hat = successes / total;
const denom = 1 + (z * z) / total;
return (p_hat + (z*z)/(2*total)) / denom;`,
    testRate: "Wilson CI ±2.4% avg",
  },
];

export function LandingClient({ isAuthenticated }: LandingClientProps) {
  const [activeMatchupIndex, setActiveMatchupIndex] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activeScorerId, setActiveScorerId] = useState<string>("exact-match");
  const [heroBenchmarkMode, setHeroBenchmarkMode] = useState<"reasoning" | "coding">("reasoning");

  const currentMatchup = MATCHUPS[activeMatchupIndex];

  // Filter benchmarks according to chosen category tab
  const filteredBenchmarks = selectedCategory === "All"
    ? currentMatchup.benchmarks
    : currentMatchup.benchmarks.filter((b) => b.category === selectedCategory);

  const activeScorer = SCORER_METHODS.find((s) => s.id === activeScorerId) || SCORER_METHODS[0];

  const heroModels = heroBenchmarkMode === "reasoning"
    ? [
        { name: "OpenAI GPT-6 Astra", lab: "OpenAI", score: "98.8%", width: 98.8, color: "#171717", badge: "Rank #1" },
        { name: "Claude Fable 5.1", lab: "Anthropic", score: "98.4%", width: 98.4, color: "#EA580C", badge: "Rank #2" },
        { name: "DeepSeek V4.1 Flash", lab: "DeepSeek", score: "97.8%", width: 97.8, color: "#6366F1", badge: "Rank #3" },
        { name: "Qwen 3.8 72B", lab: "Alibaba", score: "95.2%", width: 95.2, color: "#0D9488", badge: "Rank #4" },
        { name: "Gemini 3.8 Flash", lab: "Google", score: "94.8%", width: 94.8, color: "#2563EB", badge: "Rank #5" },
      ]
    : [
        { name: "Claude Fable 5.1", lab: "Anthropic", score: "98.4%", width: 98.4, color: "#EA580C", badge: "Rank #1" },
        { name: "OpenAI GPT-6 Astra", lab: "OpenAI", score: "96.5%", width: 96.5, color: "#171717", badge: "Rank #2" },
        { name: "DeepSeek V4.1 Flash", lab: "DeepSeek", score: "95.8%", width: 95.8, color: "#6366F1", badge: "Rank #3" },
        { name: "Qwen 3.8 72B", lab: "Alibaba", score: "94.8%", width: 94.8, color: "#0D9488", badge: "Rank #4" },
        { name: "Claude 3.5 Sonnet", lab: "Anthropic", score: "92.0%", width: 92.0, color: "#EA580C", badge: "Rank #5" },
      ];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans selection:bg-blue-600 selection:text-white relative overflow-hidden">
      
      {/* Subtle Atmospheric Ambient Glow */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div 
          style={{
            clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)'
          }} 
          className="relative left-[calc(50%-11rem)] aspect-1155/678 w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-linear-to-tr from-blue-600/10 to-indigo-500/10 opacity-60 sm:left-[calc(50%-20rem)] sm:w-[68rem]"
        />
      </div>

      {/* Floating Pill Nav */}
      <header className="sticky top-4 z-50 mx-auto max-w-5xl px-6">
        <nav className="flex h-14 items-center justify-between rounded-full border border-border bg-card/90 px-5 shadow-xs backdrop-blur-md">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tracking-tight shadow-xs">
              O
            </span>
            <span className="text-base font-bold tracking-tight text-foreground">
              Orbbit
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              Observatory
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#comparison" className="hover:text-foreground transition-colors">Benchmark Arena</a>
            <a href="#methodology" className="hover:text-foreground transition-colors">Scoring Engine</a>
            <a href="#features" className="hover:text-foreground transition-colors">Capabilities</a>
            <Link href="/docs" className="hover:text-foreground transition-colors">Documentation</Link>
          </div>

          <div className="flex items-center gap-2.5">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-95 transition-all active:scale-[0.98]"
              >
                <span>Dashboard</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 dark:bg-black/20 transition-transform duration-200 group-hover:translate-x-0.5">
                  <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ) : (
              <>
                <Link
                  href="/api/auth/demo"
                  className="hidden sm:inline-flex items-center justify-center rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors active:scale-[0.98] shadow-2xs"
                >
                  Try demo
                </Link>
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-95 transition-all active:scale-[0.98]"
                >
                  <span>Sign in</span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 dark:bg-black/20 transition-transform duration-200 group-hover:translate-x-0.5">
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-16 md:pt-20 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text */}
          <div className="lg:col-span-7 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 px-3.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>Independent Frontier AI Benchmark Observatory</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.12]"
            >
              Compare AI models with standardized benchmarks
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="text-base sm:text-lg text-muted-foreground max-w-[56ch] leading-relaxed"
            >
              Empirical evaluations across 446+ frontier & open-weight models. Balance raw task accuracy, token cost economics, and latency with calibrated Wilson 95% confidence bounds.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-3.5 pt-2"
            >
              <Link
                href="/api/auth/demo"
                className="group inline-flex items-center gap-2.5 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95 transition-all active:scale-[0.98]"
              >
                <span>Explore Interactive Demo</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 dark:bg-black/20 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
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
            </motion.div>

            {/* Quick Metrics Ticker */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.32 }}
              className="flex items-center gap-6 pt-4 border-t border-border text-xs text-muted-foreground"
            >
              <div>
                <span className="font-bold text-foreground font-mono">446+</span> Models Evaluated
              </div>
              <div className="h-3 w-px bg-border" />
              <div>
                <span className="font-bold text-foreground font-mono">18</span> Standard Suites
              </div>
              <div className="h-3 w-px bg-border" />
              <div>
                <span className="font-bold text-foreground font-mono">95%</span> Wilson Confidence
              </div>
            </motion.div>
          </div>

          {/* Right Hero Interactive Radar Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5"
          >
            <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Frontier Benchmark SOTA</h3>
                  <p className="text-[11px] text-muted-foreground">Wilson 95% Confidence Intervals</p>
                </div>
                
                {/* Switcher */}
                <div className="flex items-center p-0.5 bg-muted rounded-lg border border-border text-xs">
                  <button
                    onClick={() => setHeroBenchmarkMode("reasoning")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      heroBenchmarkMode === "reasoning"
                        ? "bg-card text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    MMLU
                  </button>
                  <button
                    onClick={() => setHeroBenchmarkMode("coding")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      heroBenchmarkMode === "coding"
                        ? "bg-card text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    HumanEval
                  </button>
                </div>
              </div>

              {/* Models List */}
              <div className="space-y-3.5 pt-5">
                {heroModels.map((m, i) => (
                  <div key={m.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground text-[11px] font-semibold w-3.5">
                          {i + 1}
                        </span>
                        <span className="font-semibold text-foreground">{m.name}</span>
                        <span className="text-[10px] text-muted-foreground">({m.lab})</span>
                      </div>
                      <span className="font-mono font-bold text-foreground">{m.score}</span>
                    </div>

                    {/* Animated Bar */}
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <motion.div
                        key={`${heroBenchmarkMode}-${m.name}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${m.width}%` }}
                        transition={{ duration: 0.6, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: m.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Card Footer */}
              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Standardized 500 questions</span>
                </span>
                <Link
                  href={isAuthenticated ? "/dashboard/leaderboard" : "/docs#overview"}
                  className="font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  <span>{isAuthenticated ? "Full Leaderboard" : "Explore Documentation"}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION: THE BENCHMARKING ARENA (Interactive Showcase) */}
      <section id="comparison" className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-10 shadow-xs">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-border">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 mb-3">
                <GitCompare className="h-3.5 w-3.5" />
                <span>Interactive Benchmark Arena</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Head-to-Head Benchmark Comparisons
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Side-by-side empirical performance across standardized benchmarks. Select a flagship matchup and filter categories to inspect measured accuracy, response latency, and token economics.
              </p>
            </div>

            {/* Matchup Switcher Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-muted rounded-2xl border border-border shrink-0 scrollbar-none">
              {MATCHUPS.map((matchup, idx) => (
                <button
                  key={matchup.id}
                  onClick={() => setActiveMatchupIndex(idx)}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap active:scale-[0.98] ${
                    activeMatchupIndex === idx
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {matchup.badge}
                </button>
              ))}
            </div>
          </div>

          {/* Active Matchup Card Body */}
          <div className="pt-8 space-y-6">
            
            {/* Matchup Banner & Model Identities */}
            <div className="bg-muted/40 p-6 rounded-2xl border border-border space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground">
                    {currentMatchup.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {currentMatchup.subtitle}
                  </p>
                </div>

                {/* Model Chips */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-xl shadow-2xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: currentMatchup.modelA.color }} />
                    <span className="text-xs font-bold text-foreground">{currentMatchup.modelA.shortName}</span>
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{currentMatchup.modelA.badge}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-muted-foreground">VS</span>
                  <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-xl shadow-2xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: currentMatchup.modelB.color }} />
                    <span className="text-xs font-bold text-foreground">{currentMatchup.modelB.shortName}</span>
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{currentMatchup.modelB.badge}</span>
                  </div>
                </div>
              </div>

              {/* Hardware & Economics HUD */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-card p-3.5 rounded-xl border border-border shadow-2xs">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">Median Latency (P50)</span>
                  <p className="text-sm font-bold text-foreground mt-1">{currentMatchup.specs.latencyA} vs {currentMatchup.specs.latencyB}</p>
                </div>
                <div className="bg-card p-3.5 rounded-xl border border-border shadow-2xs">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">Price / 1M Input Tokens</span>
                  <p className="text-sm font-bold text-foreground mt-1">{currentMatchup.specs.costA} vs {currentMatchup.specs.costB}</p>
                </div>
                <div className="bg-card p-3.5 rounded-xl border border-border shadow-2xs">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">Context Window</span>
                  <p className="text-sm font-bold text-foreground mt-1">{currentMatchup.specs.contextA} vs {currentMatchup.specs.contextB}</p>
                </div>
                <div className="bg-card p-3.5 rounded-xl border border-border shadow-2xs">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">Throughput Speed</span>
                  <p className="text-sm font-bold text-foreground mt-1">{currentMatchup.specs.throughputA} vs {currentMatchup.specs.throughputB}</p>
                </div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">Filter Benchmark:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["All", "Knowledge", "Code", "Math", "Reasoning"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        selectedCategory === cat
                          ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-xs text-muted-foreground font-mono">
                Showing {filteredBenchmarks.length} suites
              </span>
            </div>

            {/* Benchmark Comparison Rows */}
            <div className="space-y-3">
              <div className="hidden sm:grid grid-cols-12 text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-4 pb-1">
                <div className="col-span-3">Benchmark Suite & Focus</div>
                <div className="col-span-6 text-center">Measured Accuracy Comparison</div>
                <div className="col-span-3 text-right">Advantage Delta</div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={`${currentMatchup.id}-${selectedCategory}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-2.5"
                >
                  {filteredBenchmarks.map((bench) => (
                    <div
                      key={bench.name}
                      className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:border-border/80 transition-all shadow-2xs"
                    >
                      {/* Name & Category */}
                      <div className="sm:col-span-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{bench.name}</span>
                          <span className="text-[10px] font-semibold bg-muted px-2 py-0.5 rounded text-muted-foreground">
                            {bench.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                          {bench.description}
                        </p>
                      </div>

                      {/* Visual Bars Comparison */}
                      <div className="sm:col-span-6 space-y-2 px-0 sm:px-4">
                        {/* Model A */}
                        <div className="flex items-center gap-2.5">
                          <span className="text-[11px] font-mono text-muted-foreground w-20 truncate font-semibold">
                            {currentMatchup.modelA.shortName}
                          </span>
                          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${bench.scoreA}%` }}
                              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: currentMatchup.modelA.color }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold text-foreground w-12 text-right">
                            {bench.scoreA.toFixed(1)}%
                          </span>
                        </div>

                        {/* Model B */}
                        <div className="flex items-center gap-2.5">
                          <span className="text-[11px] font-mono text-muted-foreground w-20 truncate font-semibold">
                            {currentMatchup.modelB.shortName}
                          </span>
                          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${bench.scoreB}%` }}
                              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: currentMatchup.modelB.color }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold text-foreground w-12 text-right">
                            {bench.scoreB.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Winner Advantage Badge */}
                      <div className="sm:col-span-3 flex sm:justify-end items-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold font-mono ${
                          bench.winner === "A"
                            ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700"
                            : bench.winner === "B"
                            ? "bg-orange-50 text-orange-900 dark:bg-orange-950/60 dark:text-orange-200 border border-orange-200 dark:border-orange-800"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}>
                          <Trophy className="h-3 w-3" />
                          <span>{bench.delta}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom Callout */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>All evaluations calibrated using Wilson Score 95% confidence intervals.</span>
              </div>
              <Link
                href="/dashboard/compare"
                className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:underline"
              >
                <span>Launch full interactive compare matrix</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION: SCORER METHODOLOGIES (Interactive Inspector) */}
      <section id="methodology" className="mx-auto max-w-6xl px-6 py-12 md:py-16">
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

        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Tabs */}
            <div className="lg:col-span-5 space-y-2">
              {SCORER_METHODS.map((method) => {
                const Icon = method.icon;
                const isActive = activeScorerId === method.id;
                return (
                  <button
                    key={method.id}
                    onClick={() => setActiveScorerId(method.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      isActive
                        ? "bg-muted/70 border-border shadow-2xs"
                        : "bg-transparent border-transparent hover:bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{method.name}</p>
                          <span className="text-[10px] text-muted-foreground">{method.badge}</span>
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 transition-transform ${isActive ? "rotate-90 text-foreground" : "text-muted-foreground"}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Code & Methodology Detail */}
            <div className="lg:col-span-7 bg-muted/40 p-6 rounded-2xl border border-border space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Scorer Implementation
                </span>
                <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900">
                  {activeScorer.testRate}
                </span>
              </div>

              <p className="text-sm text-foreground leading-relaxed">
                {activeScorer.desc}
              </p>

              {/* Code Snippet Box */}
              <div className="rounded-xl bg-neutral-950 text-neutral-100 p-4 font-mono text-xs overflow-x-auto shadow-inner">
                <div className="flex items-center gap-1.5 pb-2 border-b border-neutral-800 text-[11px] text-neutral-400">
                  <span className="h-2 w-2 rounded-full bg-neutral-700" />
                  <span>scorer_harness.ts</span>
                </div>
                <pre className="pt-3 text-[11px] leading-relaxed text-neutral-300">
                  <code>{activeScorer.code}</code>
                </pre>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Verified by 17 unit test suites</span>
                <Link
                  href="/dashboard/evaluate"
                  className="font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  <span>Run custom evaluation</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION: CAPABILITIES BENTO GRID */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-3 py-1 rounded-full border border-border">
            Platform Capabilities
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-3">
            Designed for Rigorous Decision-Making
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-card border border-border rounded-3xl p-8 hover:border-border/80 transition-all shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-5 w-5 text-blue-600" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pareto Decision Matrix</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Dynamic Value Score™ Ranking</h3>
              <p className="text-sm text-muted-foreground max-w-[50ch] leading-relaxed">
                A multi-criteria ranking that balances accuracy, cost, and speed. Adjust priorities to match your production needs and instantly recalculate rankings.
              </p>
            </div>
            <div className="pt-6">
              <Link href="/dashboard/leaderboard" className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1">
                Configure weight sliders in leaderboard →
              </Link>
            </div>
          </div>

          <div className="md:col-span-1 bg-card border border-border rounded-3xl p-8 hover:border-border/80 transition-all shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-5 w-5 text-blue-600" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Auditability</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Prompt Traceability</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Trace every evaluation back to its source prompt. Audit raw outputs, truth bounds, and execution latency.
              </p>
            </div>
            <div className="pt-6">
              <Link href="/dashboard/evaluations" className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1">
                Inspect recorded traces →
              </Link>
            </div>
          </div>

          <div className="md:col-span-1 bg-card border border-border rounded-3xl p-8 hover:border-border/80 transition-all shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statistical Bounds</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Wilson 95% Confidence</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Wilson 95% confidence intervals on all results, ensuring you make choices based on reliable empirical data.
              </p>
            </div>
            <div className="pt-6">
              <Link href="/dashboard/leaderboard" className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1">
                View confidence intervals →
              </Link>
            </div>
          </div>

          <div className="md:col-span-2 bg-card border border-border rounded-3xl p-8 hover:border-border/80 transition-all shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-5 w-5 text-blue-600" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom Evaluation</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Custom Benchmarks (BYOD)</h3>
              <p className="text-sm text-muted-foreground max-w-[50ch] leading-relaxed">
                Bring your own evaluation suites to test models against your domain-specific problems and proprietary workloads via CSV or JSON.
              </p>
            </div>
            <div className="pt-6">
              <Link href="/dashboard/evaluate" className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1">
                Upload benchmark & test →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* High-Contrast Footer */}
      <footer className="mx-auto max-w-6xl px-6 py-12 border-t border-border mt-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-1 space-y-3">
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
              <li><Link href="/api/auth/demo" className="hover:text-foreground">Interactive Demo</Link></li>
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
