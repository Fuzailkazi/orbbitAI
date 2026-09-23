"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight, Percent, Scale, Terminal } from "lucide-react";

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
    id: "pass-at-k",
    name: "Pass@k Code Scorer",
    badge: "Static Analysis",
    icon: Terminal,
    desc: "Verifies that generated Python defines the requested entry-point function and returns a value — a static pass@1 proxy. Model output is never executed on Orbbit servers.",
    code: `// PassAtKScorer (static pass@1 proxy):
const hasDef = /def\\s+has_close_elements\\b/.test(response); // entry point from metadata
const hasReturn = /\\breturn\\b/.test(response);
return hasDef && hasReturn;`,
    testRate: "No code execution",
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
const z = 1.96; // 95% standard score
const p_hat = successes / total;
const denom = 1 + (z * z) / total;
return (p_hat + (z*z)/(2*total)) / denom;`,
    testRate: "Asymmetric bounds",
  },
];

/** Scoring-engine inspector: method tabs on the left, implementation detail on the right. */
export function ScorerInspector({ avgCiHalfWidth }: { avgCiHalfWidth: number | null }) {
  const [activeScorerId, setActiveScorerId] = useState<string>("exact-match");

  const activeScorer = SCORER_METHODS.find((s) => s.id === activeScorerId) || SCORER_METHODS[0];
  const activeScorerRate =
    activeScorer.id === "wilson-interval" && avgCiHalfWidth !== null
      ? `Wilson CI ±${avgCiHalfWidth.toFixed(1)} pts avg`
      : activeScorer.testRate;

  return (
    <div className="bg-card border border-border rounded-3xl p-4 sm:p-8 shadow-xs">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Tabs */}
        <div className="lg:col-span-5 space-y-2">
          {SCORER_METHODS.map((method) => {
            const Icon = method.icon;
            const isActive = activeScorerId === method.id;
            return (
              <button
                key={method.id}
                type="button"
                aria-pressed={isActive}
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
        <div className="lg:col-span-7 min-w-0 bg-muted/40 p-4 sm:p-6 rounded-2xl border border-border space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Scorer Implementation
            </span>
            <span className="text-xs font-mono font-semibold text-success bg-success/10 px-2.5 py-0.5 rounded border border-success/20 whitespace-nowrap shrink-0">
              {activeScorerRate}
            </span>
          </div>

          <p className="text-sm text-foreground leading-relaxed">
            {activeScorer.desc}
          </p>

          {/* Code Snippet Box */}
          <div className="rounded-xl bg-code text-code-foreground p-4 font-mono text-xs overflow-x-auto shadow-inner">
            <div className="flex items-center gap-1.5 pb-2 border-b border-code-border text-[11px] text-code-muted">
              <span className="h-2 w-2 rounded-full bg-code-muted" />
              <span>scorer_harness.ts</span>
            </div>
            <pre className="pt-3 text-[11px] leading-relaxed text-code-foreground">
              <code>{activeScorer.code}</code>
            </pre>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Scorers are unit-tested in the repo</span>
            <Link
              href="/dashboard/evaluate"
              className="font-semibold text-brand hover:underline inline-flex items-center gap-1"
            >
              <span>Run custom evaluation</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
