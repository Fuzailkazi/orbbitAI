import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen, Code2, Terminal, ArrowLeft, ArrowRight, Sparkles, ShieldCheck,
  Scale, Database, CheckCircle2, Sliders, PlayCircle, Gavel,
} from "lucide-react";
import { JSON_SNIPPET } from "./docs-data";
import { DocsMobileNav, DocsNavProvider, DocsSidebarNav } from "./docs-nav";
import { CopyJsonButton } from "./copy-json-button";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Learn how to use Orbbit to benchmark AI models, evaluate accuracy, analyze token economics, configure Dynamic Value Score, and run custom evaluation suites.",
};

/**
 * Fully static, server-rendered documentation. Only the section nav (scroll-spy + filter) and
 * the copy button hydrate as client islands.
 */
export default function DocsPage() {
  return (
    <DocsNavProvider>
      <div className="min-h-[100dvh] bg-background text-foreground font-sans selection:bg-brand selection:text-brand-foreground">
        
        {/* Top Navbar */}
        <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-6">
              <Link href="/" className="flex shrink-0 items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tracking-tight shadow-xs">
                  O
                </span>
                <span className="text-base font-bold tracking-tight text-foreground">
                  Orbbit
                </span>
                <span className="hidden min-[400px]:inline text-xs text-muted-foreground font-semibold px-2 py-0.5 rounded-full bg-muted border border-border">
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
                href="/api/auth/demo" prefetch={false}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-95 transition-all active:scale-[0.98]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="sm:hidden">Try demo</span>
                <span className="hidden sm:inline">Launch Interactive Demo</span>
              </Link>
            </div>
          </div>
        </header>

        <DocsMobileNav />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            
            {/* Left Sidebar Navigation */}
            <aside className="hidden lg:block lg:col-span-3 lg:sticky lg:top-24 space-y-6">
              
              <DocsSidebarNav />

              {/* Quick Demo Callout */}
              <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <PlayCircle className="h-4 w-4 text-brand" />
                  <span>Ready to experiment?</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Log into our guest environment instantly with zero configuration or API key requirements.
                </p>
                <Link
                  href="/api/auth/demo" prefetch={false}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline pt-1"
                >
                  <span>Enter Guest Demo</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

            </aside>

            {/* Main Content Area */}
            <main className="lg:col-span-9 min-w-0 space-y-16 pb-24">
              
              {/* 1. OVERVIEW */}
              <section id="overview" className="scroll-mt-32 lg:scroll-mt-24 space-y-4 pt-2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/20 px-3 py-1 text-xs font-semibold text-brand">
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
                    <ShieldCheck className="h-5 w-5 text-success" />
                    <h2 className="text-sm font-bold text-foreground">Independent Verification</h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Provider numbers are self-reported. Orbbit runs every model through the same OpenRouter gateway with identical prompts and scorers, and keeps every graded response.
                    </p>
                  </div>
                  <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs space-y-2">
                    <Scale className="h-5 w-5 text-brand" />
                    <h2 className="text-sm font-bold text-foreground">Statistical Rigor</h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      All leaderboard positions calculate Wilson 95% confidence intervals to eliminate small-sample noise and false ranking claims.
                    </p>
                  </div>
                  <div className="bg-card p-5 rounded-2xl border border-border shadow-2xs space-y-2">
                    <Sliders className="h-5 w-5 text-brand" />
                    <h2 className="text-sm font-bold text-foreground">Dynamic Value Score™</h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Accuracy alone is useless if a model is 5× slower and 10× more expensive. Balance quality, cost, and speed to match your SLA.
                    </p>
                  </div>
                </div>
              </section>

              {/* 2. QUICK START GUIDE */}
              <section id="quickstart" className="scroll-mt-32 lg:scroll-mt-24 space-y-4 pt-8 border-t border-border">
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
                        Click <Link href="/api/auth/demo" prefetch={false} className="text-brand underline font-medium">Try Demo</Link> for instant one-click guest access, or sign in with your email to persist your custom benchmarks and evaluation history.
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
                        Navigate to the <strong>Models Catalog</strong> to explore the OpenRouter-synced catalog with token pricing ($/1M), context window specifications, and vendor capability tags. Latency and throughput come from recorded evaluations, not vendor claims.
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
                        Select models in the <strong>Head-to-Head Compare</strong> matrix or start a live evaluation run on MMLU, GSM8K, HumanEval, or your own uploaded CSV/JSON dataset. Live runs use free-tier (<code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">:free</code>) OpenRouter models and grade up to 50 questions per run.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. EVALUATION WORKFLOWS */}
              <section id="evaluations" className="scroll-mt-32 lg:scroll-mt-24 space-y-4 pt-8 border-t border-border">
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
                      <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">161 Problems</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Measures program synthesis. Orbbit uses the JavaScript port from MultiPL-E: the model completes each function, and the answer passes only if it runs the problem&apos;s unit tests without a failure (pass@1).
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
                      <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">500 Problems</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Competition problems formatted in LaTeX spanning algebra, number theory, geometry, counting and probability. Orbbit uses MATH-500, the standard 500-problem subset of the MATH test set.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Question counts are the size of each upstream dataset. Orbbit imports a fixed, seeded random sample of it from Hugging Face (every question records its dataset, split and row index), a run grades the first <code className="text-foreground">n</code> questions of that sample, and every stored evaluation shows its own sample size next to its Wilson interval. No score is ever entered by hand.
                </p>

                <div className="bg-muted/40 p-6 rounded-2xl border border-border space-y-2">
                  <p className="text-xs font-bold text-foreground">How live runs execute</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Starting a run calls <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">POST /api/evaluations/run</code>, which sends each prompt to the model through OpenRouter and streams per-prompt progress back to the browser as Server-Sent Events. Every response, latency, and token count is saved as it arrives. Failed prompts, and responses a scorer cannot grade, are recorded with their reason, excluded from accuracy and counted in the failure rate; they are never retried silently. A queued background runner (Inngest) is on the roadmap and not used yet.
                  </p>
                </div>
              </section>

              {/* 4. SCORING ENGINES */}
              <section id="scorers" className="scroll-mt-32 lg:scroll-mt-24 space-y-4 pt-8 border-t border-border">
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
                        <CheckCircle2 className="h-4 w-4 text-brand" />
                        <h3 className="text-sm font-bold text-foreground">ExactMatchScorer</h3>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">MMLU, ARC, GPQA</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Extracts the chosen option letter (A–D, up to J for MMLU-Pro) even when the model answers conversationally, e.g. &quot;Based on the analysis, the correct option is (C)&quot;. An explicit &quot;Answer: X&quot; wins over letters mentioned while reasoning, and reasoning-model <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">&lt;think&gt;</code> blocks are ignored.
                    </p>
                  </div>

                  {/* Scorer 2 */}
                  <div className="bg-card rounded-2xl border border-border p-6 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-success" />
                        <h3 className="text-sm font-bold text-foreground">NormalizedMatchScorer</h3>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">GSM8K, MATH</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      GSM8K: reads the final <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">Answer: [number]</code> line and compares numerically, ignoring commas, currency symbols and units. MATH: reads the last <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">\boxed&#123;result&#125;</code> and compares after conservative LaTeX normalization (no symbolic algebra, so an unusual but equivalent form can be marked wrong).
                    </p>
                  </div>

                  {/* Scorer 3 */}
                  <div className="bg-card rounded-2xl border border-border p-6 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Code2 className="h-4 w-4 text-brand" />
                        <h3 className="text-sm font-bold text-foreground">PassAtKScorer (pass@1, executed)</h3>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">HumanEval, MBPP</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Runs the generated JavaScript against the problem&apos;s MultiPL-E unit tests in a sandboxed worker (fresh <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">vm</code> context, no modules, filesystem, network or timers, 5 s and 64 MB limits). The answer passes only if every assertion holds.
                    </p>
                  </div>

                  {/* Scorer 4 */}
                  <div className="bg-card rounded-2xl border border-border p-6 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gavel className="h-4 w-4 text-brand" />
                        <h3 className="text-sm font-bold text-foreground">LLMJudgeScorer</h3>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">MT-Bench, AlpacaEval</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Sends the instruction, the model&apos;s answer and any reference to a free-tier judge model via OpenRouter, which returns a pass/fail verdict with reasoning. For AlpacaEval the reference is a text-davinci-003 baseline, so a pass means &quot;at least as good as the baseline&quot;. A model never judges its own answers, and if the judge is unavailable the prompt is marked unscored instead of guessed. The judge&apos;s reasoning is stored with every result.
                    </p>
                  </div>

                </div>
              </section>

              {/* 5. SPACES */}
              <section id="spaces" className="scroll-mt-32 lg:scroll-mt-24 space-y-4 pt-8 border-t border-border">
                <h2 className="text-2xl font-bold text-foreground">
                  5. Spaces: Domain-Level Rankings
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A single benchmark answers a narrow question (&ldquo;how good is this model at grade-school math word problems?&rdquo;). You usually care about a whole domain: math, coding, support-style chat. A <strong className="text-foreground">Space</strong> is a named group of benchmarks. It pools every scored question across them into one accuracy with a Wilson 95% interval, so you can ask &ldquo;which model is best at <em>this kind of work</em>?&rdquo;
                </p>

                <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Reading a space card</h3>
                  <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed list-disc pl-4">
                    <li><strong className="text-foreground">Benchmarks.</strong> The chips list the member benchmarks. Click one to see every evaluation on that benchmark.</li>
                    <li><strong className="text-foreground">Pooled accuracy.</strong> Correct answers divided by scored questions, summed over every completed evaluation on the member benchmarks, across all models. It shows how hard the domain is overall. Failed calls and unscored prompts are left out of the denominator, the same as on single evaluations. The &ldquo;q&rdquo; count is the pooled sample size behind the interval.</li>
                    <li><strong className="text-foreground">Top model.</strong> Each model&apos;s own pooled accuracy, ranked by the <em>lower</em> bound of its Wilson interval, not the point estimate. A model that went 3/3 on a tiny run can&apos;t outrank one that went 180/200.</li>
                    <li><strong className="text-foreground">View in leaderboard.</strong> Opens the leaderboard, filtered to the benchmark when the space has only one, for cost/speed trade-offs with the Value Score.</li>
                  </ul>
                </div>

                <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Recommended workflow</h3>
                  <ol className="space-y-2 text-xs text-muted-foreground leading-relaxed list-decimal pl-4">
                    <li><strong className="text-foreground">Describe your workload as benchmarks.</strong> For a support assistant, MT-Bench + AlpacaEval + TruthfulQA. For a coding agent, HumanEval + MBPP. For a data or finance tool, GSM8K + MATH. Add your own uploaded benchmark (see <a href="#byod" className="text-brand hover:underline">Custom Datasets</a>). It is usually the most representative member.</li>
                    <li><strong className="text-foreground">Create the space.</strong> On <Link href="/dashboard/spaces" className="text-brand hover:underline">Spaces</Link>, click <em>Create space</em>, name it, pick an icon, and select at least one benchmark.</li>
                    <li><strong className="text-foreground">Evaluate your candidates on every member benchmark.</strong> A model only counts where it has completed evaluations. Run them from <Link href="/dashboard/evaluate" className="text-brand hover:underline">Run Evaluation</Link> or with <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">pnpm eval:batch --benchmarks GSM8K,MATH</code>.</li>
                    <li><strong className="text-foreground">Read the card, then drill in.</strong> Check the top model and its interval, open <Link href="/dashboard/compare" className="text-brand hover:underline">Compare</Link> for the top two to see the per-benchmark gaps and whether the intervals overlap, then click through to prompt-level results on anything surprising.</li>
                  </ol>
                </div>

                <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-3">
                  <h3 className="text-sm font-bold text-foreground">Things to know</h3>
                  <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed list-disc pl-4">
                    <li><strong className="text-foreground">Pooling weights by question count.</strong> A benchmark with 200 scored questions pulls harder than one with 80. If one member should dominate, give it more questions. If they should count equally, compare per benchmark in Compare instead.</li>
                    <li><strong className="text-foreground">Overlapping intervals mean &ldquo;no clear winner&rdquo;.</strong> The top model is the best-supported pick, not proof that it beats the runner-up.</li>
                    <li><strong className="text-foreground">Benchmarks that aren&apos;t runnable yet add nothing.</strong> IFEval, DROP, LiveCodeBench and BBH have no faithful automatic scorer yet. GPQA needs a Hugging Face token. A space made only of those shows no accuracy.</li>
                    <li><strong className="text-foreground">Curated spaces are read-only.</strong> The six built-in spaces (Mathematics, Code Generation, Reasoning, Chat Quality, Factuality, Agentic) can&apos;t be deleted, and their names are reserved, case-insensitively.</li>
                    <li><strong className="text-foreground">Spaces are shared.</strong> Spaces have no per-user owner yet, so anyone signed in, including guest demo sessions, sees every space and can delete non-curated ones.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-foreground">API</div>
                  <pre className="bg-code text-code-foreground p-4 rounded-2xl font-mono text-xs overflow-x-auto">
                    <code>{`POST   /api/spaces        { "name": "Support bot", "description": "…", "icon": "message-circle",
                           "benchmarkIds": ["<benchmark uuid>", …] }       → 201 { success, data }
DELETE /api/spaces?id=<space uuid>                                          → 200

Errors: { "error": string, "code": string }
  401 UNAUTHORIZED        no session (sign in or start the guest demo)
  400 VALIDATION_ERROR    name missing/over 80 chars, description over 500, 0 or more than 50 benchmarks, unknown ids
  409 PROTECTED_RESOURCE  name collides with a curated space
  403 PROTECTED_RESOURCE  deleting a curated space
  404 NOT_FOUND           no space with that id`}</code>
                  </pre>
                </div>
              </section>

              {/* 6. WILSON 95% CONFIDENCE */}
              <section id="statistical-rigor" className="scroll-mt-32 lg:scroll-mt-24 space-y-4 pt-8 border-t border-border">
                <h2 className="text-2xl font-bold text-foreground">
                  6. Statistical Rigor: Wilson 95% Confidence Intervals
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A common flaw in modern AI leaderboards is reporting raw point estimates without sample size context. For instance, if Model A achieves <strong>86%</strong> on 50 questions and Model B achieves <strong>82%</strong> on 50 questions, are they actually different?
                </p>

                <div className="bg-muted/40 p-6 rounded-2xl border border-border space-y-3">
                  <p className="text-xs font-bold text-foreground">The Wilson Score Interval Formula:</p>
                  <div className="bg-card p-4 rounded-xl border border-border font-mono text-xs text-foreground overflow-x-auto shadow-2xs">
                    CI = (p̂ + z²/(2n) ± z × √( (p̂(1-p̂)/n) + (z²/(4n²)) )) / (1 + z²/n)
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Where <code className="text-foreground">p̂</code> is the observed success rate, <code className="text-foreground">n</code> is the sample size, and <code className="text-foreground">z = 1.96</code> for 95% confidence. At n=50, Model A&apos;s interval is 73.8–93.0% and Model B&apos;s is 69.2–90.2%. The intervals overlap heavily, so the two scores are statistically indistinguishable. Orbbit computes these intervals for every evaluation so you never deploy a model based on statistical noise.
                  </p>
                </div>
              </section>

              {/* 7. DYNAMIC VALUE SCORE */}
              <section id="value-score" className="scroll-mt-32 lg:scroll-mt-24 space-y-4 pt-8 border-t border-border">
                <h2 className="text-2xl font-bold text-foreground">
                  7. Dynamic Value Score™
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  In production, model choice is rarely just about accuracy. A model that scores 98% but costs $15/1M tokens and takes 800ms may be entirely unsuitable for a customer-facing autocomplete or real-time agent.
                </p>

                <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Composite Decision Model</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The Value Score normalizes Accuracy (0–100), Cost (log-scaled price per 1M input tokens, cheaper is better), and Speed (square-root-scaled average latency, faster is better) into a unified 0–100 score weighted by your business priorities (defaults: quality 50, cost 25, speed 25):
                  </p>

                  <div className="bg-code text-code-foreground p-4 rounded-xl font-mono text-xs overflow-x-auto">
                    ValueScore = 100 × (w_quality × Quality + w_cost × CostScore + w_speed × SpeedScore) / (w_quality + w_cost + w_speed)
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    On the <strong>Leaderboard</strong> page, drag the three interactive weight faders to reflect your production constraints. The entire frontier model leaderboard instantly re-ranks in real time.
                  </p>
                </div>
              </section>

              {/* 8. CUSTOM DATASETS (BYOD) */}
              <section id="byod" className="scroll-mt-32 lg:scroll-mt-24 space-y-4 pt-8 border-t border-border">
                <h2 className="text-2xl font-bold text-foreground">
                  8. Custom Datasets (Bring Your Own Data)
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Test models against your proprietary company workloads, support tickets, internal reasoning questions, or domain-specific logic.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                    <span>Supported JSON Dataset Format</span>
                    <CopyJsonButton />
                  </div>

                  <pre className="bg-code text-code-foreground p-4 rounded-2xl font-mono text-xs overflow-x-auto">
                    <code>{JSON_SNIPPET}</code>
                  </pre>
                  <p className="text-xs text-muted-foreground">
                    Each item needs a <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">prompt</code> (or <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">question</code>) and an <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">expected_answer</code> (or <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">answer</code>). CSV files use the same names as header columns. Upload files in the <strong>Custom Evaluation</strong> interface, or post <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">{"{ name, scoringMethod, questions: [{ prompt, expected_answer }] }"}</code> to <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">/api/benchmarks/custom</code>.
                  </p>
                </div>
              </section>

              {/* 9. OPENROUTER & MODEL SYNC */}
              <section id="openrouter" className="scroll-mt-32 lg:scroll-mt-24 space-y-4 pt-8 border-t border-border">
                <h2 className="text-2xl font-bold text-foreground">
                  9. OpenRouter & Model Catalog Sync
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Orbbit integrates with OpenRouter as a unified multi-provider gateway. This allows you to evaluate models from OpenAI, Anthropic, Google DeepMind, Meta, DeepSeek, Mistral, and Qwen without configuring separate billing accounts for each vendor.
                </p>

                <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Database className="h-4 w-4 text-brand" />
                    <span>Automated Catalog Synchronization</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The <strong>Sync OpenRouter</strong> button in the Models catalog pulls the current OpenRouter catalog into Orbbit&apos;s Postgres database, picking up newly released models, price changes, and context window updates. Sync runs on demand; it is not scheduled.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/api/auth/demo" prefetch={false}
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
    </DocsNavProvider>
  );
}
