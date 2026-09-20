"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen, Code2, Terminal, FileText, Check, Copy, Search,
  ArrowLeft, ArrowRight, Sparkles, ShieldCheck, Layers, Zap,
  Scale, Activity, Cpu, Database, ExternalLink, ChevronRight,
  BarChart3, CheckCircle2, Sliders, PlayCircle
} from "lucide-react";

interface Section {
  id: string;
  title: string;
  category: string;
}

const SECTIONS: Section[] = [
  { id: "overview", title: "1. Overview & Philosophy", category: "Getting Started" },
  { id: "quickstart", title: "2. Quick Start Guide", category: "Getting Started" },
  { id: "evaluations", title: "3. Evaluation Workflows", category: "Platform Guides" },
  { id: "scorers", title: "4. Scoring Engines", category: "Platform Guides" },
  { id: "statistical-rigor", title: "5. Wilson 95% Confidence", category: "Mathematics" },
  { id: "value-score", title: "6. Dynamic Value Score™", category: "Mathematics" },
  { id: "byod", title: "7. Custom Datasets (BYOD)", category: "Developer Guides" },
  { id: "openrouter", title: "8. OpenRouter & Model Sync", category: "Developer Guides" },
];

export function DocsClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredSections = SECTIONS.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tracking-tight shadow-xs">
                O
              </span>
              <span className="text-base font-bold tracking-tight text-foreground">
                Orbbit
              </span>
              <span className="text-xs text-muted-foreground font-semibold px-2 py-0.5 rounded-full bg-muted border border-border">
                Documentation
              </span>
            </Link>

            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Home</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/api/auth/demo"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-95 transition-all active:scale-[0.98]"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-300" />
              <span>Launch Interactive Demo</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Left Sidebar Navigation */}
          <aside className="lg:col-span-3 sticky top-24 space-y-6">
            
            {/* Search filter */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2 text-xs font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              />
            </div>

            {/* Nav Groupings */}
            <nav className="space-y-4 text-xs">
              {["Getting Started", "Platform Guides", "Mathematics", "Developer Guides"].map((category) => {
                const categorySections = filteredSections.filter(s => s.category === category);
                if (categorySections.length === 0) return null;

                return (
                  <div key={category} className="space-y-1.5">
                    <p className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground px-3">
                      {category}
                    </p>
                    <div className="space-y-0.5">
                      {categorySections.map((item) => {
                        const isActive = activeSection === item.id;
                        return (
                          <a
                            key={item.id}
                            href={`#${item.id}`}
                            onClick={() => setActiveSection(item.id)}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all font-medium ${
                              isActive
                                ? "bg-muted text-foreground font-semibold shadow-2xs border border-border"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            }`}
                          >
                            <span>{item.title}</span>
                            {isActive && <ChevronRight className="h-3 w-3 text-blue-600" />}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>

            {/* Quick Demo Callout */}
            <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <PlayCircle className="h-4 w-4 text-blue-600" />
                <span>Ready to experiment?</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Log into our guest environment instantly with zero configuration or API key requirements.
              </p>
              <Link
                href="/api/auth/demo"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline pt-1"
              >
                <span>Enter Guest Demo</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

          </aside>

          {/* Main Content Area */}
          <main className="lg:col-span-9 space-y-16 pb-24">
            
            {/* 1. OVERVIEW */}
            <section id="overview" className="space-y-4 pt-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                <BookOpen className="h-3.5 w-3.5" />
                <span>Documentation & Architecture</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                Orbbit AI Evaluation Platform
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed">
                Orbbit is an independent, reproducible AI model evaluation observatory designed to solve the AI model selection crisis. Rather than relying on self-reported vendor benchmarks or opaque public rankings, Orbbit lets engineering teams verify model accuracy, token economics, and latency with calibrated statistical bounds.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs space-y-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-sm font-bold text-foreground">Independent Verification</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Provider numbers are self-reported. Orbbit runs standardized evaluations through unified gateways to prevent contamination.
                  </p>
                </div>
                <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs space-y-2">
                  <Scale className="h-5 w-5 text-blue-600" />
                  <h2 className="text-sm font-bold text-foreground">Statistical Rigor</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    All leaderboard positions calculate Wilson 95% confidence intervals to eliminate small-sample noise and false ranking claims.
                  </p>
                </div>
                <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs space-y-2">
                  <Sliders className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-sm font-bold text-foreground">Dynamic Value Score™</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Accuracy alone is useless if a model is 5× slower and 10× more expensive. Balance quality, cost, and speed to match your SLA.
                  </p>
                </div>
              </div>
            </section>

            {/* 2. QUICK START GUIDE */}
            <section id="quickstart" className="space-y-4 pt-8 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">
                2. Quick Start Guide
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You can get up and running with Orbbit in under 60 seconds without having to manage individual API keys across ten different model providers.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex gap-4 items-start bg-card p-5 rounded-2xl border border-border shadow-2xs">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground font-mono">
                    1
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground">Access the Platform</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Click <Link href="/api/auth/demo" className="text-blue-600 underline font-medium">Try Demo</Link> for instant one-click guest access, or sign in with your email or GitHub to persist your custom benchmarks and evaluation history.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start bg-card p-5 rounded-2xl border border-border shadow-2xs">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground font-mono">
                    2
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground">Explore Frontier Models</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Navigate to the <strong>Models Catalog</strong> to explore 446+ models with live latency, token pricing ($/1M), context window specifications, and vendor capability tags.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start bg-card p-5 rounded-2xl border border-border shadow-2xs">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground font-mono">
                    3
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground">Run or Compare Evaluations</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Select models in the <strong>Head-to-Head Compare</strong> matrix or trigger an automated evaluation run across MMLU, GSM8K, HumanEval, or your own uploaded CSV dataset.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. EVALUATION WORKFLOWS */}
            <section id="evaluations" className="space-y-4 pt-8 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">
                3. Evaluation Workflows
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Orbbit structures evaluations around standardized suites that probe distinct cognitive, engineering, and reasoning disciplines:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">MMLU Benchmark</span>
                    <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">14,042 Qs</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Massive Multitask Language Understanding. Probes 57 disciplines across elementary mathematics, US history, computer science, professional law, and clinical medicine.
                  </p>
                </div>

                <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">HumanEval Suite</span>
                    <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">164 Problems</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Measures program synthesis capabilities. Models are prompted with function docstrings and tested against sandboxed unit assertions for pass@1 verification.
                  </p>
                </div>

                <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">GSM8K Arithmetic</span>
                    <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">1,319 Problems</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Grade School Math 8K. Multi-step mathematical word problems requiring sequence reasoning and chain-of-thought calculation.
                  </p>
                </div>

                <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">MATH Competition</span>
                    <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">5,000 Problems</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Olympiad and high school competition problems formatted in LaTeX spanning calculus, number theory, geometry, and intermediate algebra.
                  </p>
                </div>
              </div>
            </section>

            {/* 4. SCORING ENGINES */}
            <section id="scorers" className="space-y-4 pt-8 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">
                4. Scoring Engines
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Evaluation results are only as good as the determinism of the scoring harness. Orbbit provides four specialized scorers:
              </p>

              <div className="space-y-4 pt-2">
                
                {/* Scorer 1 */}
                <div className="bg-card rounded-2xl border border-border p-6 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-foreground">ExactMatchScorer</h3>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">MMLU, ARC, GPQA</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Isolates option tokens (A, B, C, D) even when the model responds conversationally with phrases like &quot;Based on the analysis, the correct option is (C)&quot;. Eliminates false negatives caused by conversational formatting.
                  </p>
                </div>

                {/* Scorer 2 */}
                <div className="bg-card rounded-2xl border border-border p-6 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-sm font-bold text-foreground">NormalizedMatchScorer</h3>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">GSM8K, MATH</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Extracts targets from GSM8K delimiter <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">#### [number]</code> and competition LaTeX <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">\boxed&#123;result&#125;</code>. Normalizes commas, currency symbols, and trailing punctuation.
                  </p>
                </div>

                {/* Scorer 3 */}
                <div className="bg-card rounded-2xl border border-border p-6 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-indigo-600" />
                      <h3 className="text-sm font-bold text-foreground">Sandboxed Code Execution (Pass@k)</h3>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">HumanEval</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Executes code generated by models inside an isolated execution container with strict memory limits and a 5-second process timeout to verify functional correctness.
                  </p>
                </div>

              </div>
            </section>

            {/* 5. WILSON 95% CONFIDENCE */}
            <section id="statistical-rigor" className="space-y-4 pt-8 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">
                5. Statistical Rigor: Wilson 95% Confidence Intervals
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A common flaw in modern AI leaderboards is reporting raw point estimates without sample size context. For instance, if Model A achieves <strong>86%</strong> on 50 questions and Model B achieves <strong>83%</strong> on 50 questions, are they actually different?
              </p>

              <div className="bg-muted/40 p-6 rounded-2xl border border-border space-y-3">
                <p className="text-xs font-bold text-foreground">The Wilson Score Interval Formula:</p>
                <div className="bg-card p-4 rounded-xl border border-border font-mono text-xs text-foreground overflow-x-auto shadow-2xs">
                  CI = (p̂ + z²/(2n) ± z × √( (p̂(1-p̂)/n) + (z²/(4n²)) )) / (1 + z²/n)
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Where <code className="text-foreground">p̂</code> is the observed success rate, <code className="text-foreground">n</code> is the sample size, and <code className="text-foreground">z = 1.95996</code> for 95% confidence. At n=50, the margin of error is ±9.8%, meaning the scores are statistically indistinguishable. Orbbit computes these intervals for every evaluation so you never deploy a model based on statistical noise.
                </p>
              </div>
            </section>

            {/* 6. DYNAMIC VALUE SCORE */}
            <section id="value-score" className="space-y-4 pt-8 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">
                6. Dynamic Value Score™
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                In production, model choice is rarely just about accuracy. A model that scores 98% but costs $15/1M tokens and takes 800ms may be entirely unsuitable for a customer-facing autocomplete or real-time agent.
              </p>

              <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
                <h3 className="text-sm font-bold text-foreground">Composite Decision Model</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The Value Score normalizes Accuracy (0–100), Cost (log-normalized tokens per dollar), and Latency (normalized TTFT) into a unified score based on your custom business priorities:
                </p>

                <div className="bg-neutral-950 text-neutral-100 p-4 rounded-xl font-mono text-xs overflow-x-auto">
                  ValueScore = (w_accuracy × Score) + (w_cost × CostEfficiency) + (w_latency × SpeedFactor)
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  On the <strong>Leaderboard</strong> page, drag the three interactive weight faders to reflect your production constraints. The entire frontier model leaderboard instantly re-ranks in real time.
                </p>
              </div>
            </section>

            {/* 7. CUSTOM DATASETS (BYOD) */}
            <section id="byod" className="space-y-4 pt-8 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">
                7. Custom Datasets (Bring Your Own Data)
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Test models against your proprietary company workloads, support tickets, internal reasoning questions, or domain-specific logic.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span>Supported JSON Dataset Format</span>
                  <button
                    onClick={() => copyToClipboard(`[
  {
    "question": "What is the capital of Australia?",
    "options": { "A": "Sydney", "B": "Melbourne", "C": "Canberra", "D": "Perth" },
    "expectedAnswer": "C"
  },
  {
    "question": "Calculate 15% tip on $80 bill.",
    "expectedAnswer": "12"
  }
]`, "json-snippet")}
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    {copiedCode === "json-snippet" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedCode === "json-snippet" ? "Copied" : "Copy JSON"}</span>
                  </button>
                </div>

                <pre className="bg-neutral-950 text-neutral-200 p-4 rounded-2xl font-mono text-xs overflow-x-auto">
                  <code>{`[
  {
    "question": "What is the capital of Australia?",
    "options": { "A": "Sydney", "B": "Melbourne", "C": "Canberra", "D": "Perth" },
    "expectedAnswer": "C"
  },
  {
    "question": "Calculate 15% tip on $80 bill.",
    "expectedAnswer": "12"
  }
]`}</code>
                </pre>
                <p className="text-xs text-muted-foreground">
                  You can upload files directly via the <strong>Custom Evaluation</strong> interface or post them to <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">/api/benchmarks/custom</code>.
                </p>
              </div>
            </section>

            {/* 8. OPENROUTER & MODEL SYNC */}
            <section id="openrouter" className="space-y-4 pt-8 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">
                8. OpenRouter & Model Catalog Sync
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Orbbit integrates with OpenRouter as a unified multi-provider gateway. This allows you to evaluate models from OpenAI, Anthropic, Google DeepMind, Meta, DeepSeek, Mistral, and Qwen without configuring separate billing accounts for each vendor.
              </p>

              <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Database className="h-4 w-4 text-blue-600" />
                  <span>Automated Catalog Synchronization</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Our background sync routine periodically polls OpenRouter to automatically ingest newly released frontier models, price adjustments, and context window expansions into Orbbit&apos;s Postgres database.
                </p>
                <div className="pt-2">
                  <Link
                    href="/api/auth/demo"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-95 transition-all"
                  >
                    <span>Launch Orbbit Observatory</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </section>

          </main>
        </div>
      </div>

      {/* High-Contrast Footer */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Orbbit. Independent AI Evaluation Observatory.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <a href="#overview" className="hover:text-foreground">Back to Top</a>
            <a href="https://github.com/Fuzailkazi/orbbitAI" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">GitHub</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
