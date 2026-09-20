"use client";

import { useState } from "react";
import type { Model } from "@/types/database";
import { GitCompareArrows, Check, Download, Copy, FileText } from "lucide-react";
import { BenchmarkRadarChart } from "@/components/charts/benchmark-radar-chart";
import { ExecutiveReportModal } from "@/components/evaluations/executive-report-modal";

interface EvalData {
  model_id: string;
  accuracy: number;
  accuracy_ci_lower: number;
  accuracy_ci_upper: number;
  avg_latency_ms: number;
  tokens_per_second: number;
  benchmarks: { name: string } | null;
}

function fmt(ctx: number) { return ctx >= 1e6 ? `${(ctx/1e6).toFixed(1)}M` : `${(ctx/1e3).toFixed(0)}K`; }
function fmtP(p: number) { return p === 0 ? "Free" : `$${p}`; }

function Row({ label, a, b, better }: { label: string; a: string; b: string; better: "a"|"b"|"tie" }) {
  return (
    <div className="grid grid-cols-3 items-center border-b border-border/60 py-3.5 last:border-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="text-center font-mono text-sm">
        <span className={`${better === "a" ? "font-semibold text-foreground bg-muted px-2.5 py-1 rounded-md inline-flex items-center gap-1.5" : "text-muted-foreground"}`}>
          {a}
          {better === "a" && <Check className="h-3.5 w-3.5 text-blue-600 stroke-[2.5]" />}
        </span>
      </div>
      <div className="text-center font-mono text-sm">
        <span className={`${better === "b" ? "font-semibold text-foreground bg-muted px-2.5 py-1 rounded-md inline-flex items-center gap-1.5" : "text-muted-foreground"}`}>
          {b}
          {better === "b" && <Check className="h-3.5 w-3.5 text-blue-600 stroke-[2.5]" />}
        </span>
      </div>
    </div>
  );
}

export function CompareClient({ models, evaluations }: { models: Model[]; evaluations: EvalData[] }) {
  const defaultA = models.find((m) => m.api_identifier === "openai/gpt-6-astra" || m.api_identifier.includes("astra"))?.id || models[0]?.id || "";
  const defaultB = models.find((m) => m.api_identifier === "anthropic/claude-fable-5.1" || m.api_identifier.includes("fable"))?.id || models[1]?.id || "";
  const [idA, setIdA] = useState(defaultA);
  const [idB, setIdB] = useState(defaultB);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const a = models.find((m) => m.id === idA);
  const b = models.find((m) => m.id === idB);
  const eA = evaluations.filter((e) => e.model_id === idA);
  const eB = evaluations.filter((e) => e.model_id === idB);
  const namesA = new Set(eA.map((e) => (e.benchmarks as unknown as {name:string})?.name).filter(Boolean));
  const shared = [...namesA].filter((n) => eB.some((e) => (e.benchmarks as unknown as {name:string})?.name === n));
  const [copied, setCopied] = useState(false);

  function exportComparisonJson() {
    if (!a || !b) return;
    const comparisonData = {
      modelA: { name: a.name, vendor: a.vendor, context: a.context_window, pricingInput: a.pricing_input, pricingOutput: a.pricing_output },
      modelB: { name: b.name, vendor: b.vendor, context: b.context_window, pricingInput: b.pricing_input, pricingOutput: b.pricing_output },
      benchmarks: shared.map((n) => {
        const evA = eA.find((e) => (e.benchmarks as any)?.name === n);
        const evB = eB.find((e) => (e.benchmarks as any)?.name === n);
        return {
          benchmark: n,
          modelAAccuracy: evA?.accuracy,
          modelBAccuracy: evB?.accuracy,
          modelALatency: evA?.avg_latency_ms,
          modelBLatency: evB?.avg_latency_ms
        };
      })
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(comparisonData, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `orbbit_comparison_${a.name}_${b.name}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function copyShareUrl() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Model Comparison
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Compare two models side-by-side across empirical benchmarks, context windows, and token pricing.
          </p>
        </div>
        {a && b && (
          <div className="flex items-center gap-2 self-start sm:self-end">
            <button
              onClick={() => setIsReportOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-all active:scale-[0.98]"
            >
              <FileText className="h-3.5 w-3.5" /> Executive Memo
            </button>
            <button
              onClick={copyShareUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-xs hover:bg-muted transition-all active:scale-[0.98]"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
              {copied ? "Copied" : "Share"}
            </button>
            <button
              onClick={exportComparisonJson}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-xs hover:bg-muted transition-all active:scale-[0.98]"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" /> JSON
            </button>
          </div>
        )}
      </div>

      {/* Selector Cards */}
      <div className="grid gap-5 sm:grid-cols-2">
        {([["A", idA, idB, setIdA, "Baseline Model"], ["B", idB, idA, setIdB, "Candidate Model"]] as const).map(([label, val, other, set, tag]) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <span className="text-xs font-medium text-muted-foreground">
                {tag}
              </span>
              <span className="text-xs font-semibold text-foreground px-2 py-0.5 rounded-md bg-muted border border-border">
                Model {label}
              </span>
            </div>
            <select
              value={val}
              onChange={(e) => set(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-all cursor-pointer"
            >
              <option value="">Select target model...</option>
              {models.map((m) => (
                <option key={m.id} value={m.id} disabled={m.id === other}>
                  {m.name} ({m.vendor}) — {m.category}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {a && b ? (
        <div className="space-y-6">
          {/* Hardware Specifications Comparison Card */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div className="flex items-center gap-2">
                <GitCompareArrows className="h-4 w-4 text-foreground" />
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Specifications & Pricing
                </h3>
              </div>
            </div>

            {/* Table Column Labels */}
            <div className="grid grid-cols-3 items-center border-b border-border pb-3 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Parameter</span>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.vendor}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.vendor}</p>
              </div>
            </div>

            <Row label="Category" a={a.category} b={b.category} better="tie" />
            <Row label="Context Window" a={fmt(a.context_window)} b={fmt(b.context_window)} better={a.context_window > b.context_window ? "a" : a.context_window < b.context_window ? "b" : "tie"} />
            <Row label="Input Price / 1M" a={fmtP(a.pricing_input)} b={fmtP(b.pricing_input)} better={a.pricing_input < b.pricing_input ? "a" : a.pricing_input > b.pricing_input ? "b" : "tie"} />
            <Row label="Output Price / 1M" a={fmtP(a.pricing_output)} b={fmtP(b.pricing_output)} better={a.pricing_output < b.pricing_output ? "a" : a.pricing_output > b.pricing_output ? "b" : "tie"} />
          </div>

          {/* Shared Benchmark Cross-Accuracy Card */}
          {shared.length > 0 && (
            <>
              <div className="bg-card border border-border rounded-xl p-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <GitCompareArrows className="h-4 w-4 text-foreground" />
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">
                      Benchmark Accuracy
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {shared.length} shared test suites
                  </span>
                </div>

                <div className="grid grid-cols-3 items-center border-b border-border pb-3 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Test Suite</span>
                  <span className="text-center text-xs font-medium text-foreground">{a.name}</span>
                  <span className="text-center text-xs font-medium text-foreground">{b.name}</span>
                </div>

                {shared.map((bench) => {
                  const accA = eA.find((e) => (e.benchmarks as unknown as {name:string})?.name === bench)?.accuracy ?? 0;
                  const accB = eB.find((e) => (e.benchmarks as unknown as {name:string})?.name === bench)?.accuracy ?? 0;
                  return (
                    <Row
                      key={bench}
                      label={bench}
                      a={`${accA.toFixed(1)}%`}
                      b={`${accB.toFixed(1)}%`}
                      better={accA > accB ? "a" : accA < accB ? "b" : "tie"}
                    />
                  );
                })}
              </div>

              {shared.length >= 3 && (
                <div className="bg-card border border-border rounded-xl p-6 shadow-xs">
                  <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
                    <div className="flex items-center gap-2">
                      <GitCompareArrows className="h-4 w-4 text-foreground" />
                      <h3 className="text-sm font-semibold tracking-tight text-foreground">
                        Capability Radar
                      </h3>
                    </div>
                  </div>
                  <BenchmarkRadarChart
                    nameA={a.name}
                    nameB={b.name}
                    data={shared.map((bench) => ({
                      benchmark: bench,
                      modelA: eA.find((e) => (e.benchmarks as unknown as {name:string})?.name === bench)?.accuracy ?? 0,
                      modelB: eB.find((e) => (e.benchmarks as unknown as {name:string})?.name === bench)?.accuracy ?? 0,
                    }))}
                  />
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl flex flex-col items-center justify-center py-20 px-6 text-center shadow-xs">
          <div className="h-12 w-12 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground mb-4">
            <GitCompareArrows className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-foreground">Select two models</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Choose two target models in the selectors above to compare benchmark accuracy, context length, and token costs.
          </p>
        </div>
      )}

      {a && b && (
        <ExecutiveReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          modelA={{
            name: a.name,
            vendor: a.vendor,
            context: a.context_window,
            pricingInput: a.pricing_input,
            pricingOutput: a.pricing_output,
          }}
          modelB={{
            name: b.name,
            vendor: b.vendor,
            context: b.context_window,
            pricingInput: b.pricing_input,
            pricingOutput: b.pricing_output,
          }}
          benchmarks={shared.map((n) => {
            const evA = eA.find((e) => (e.benchmarks as any)?.name === n);
            const evB = eB.find((e) => (e.benchmarks as any)?.name === n);
            return {
              benchmark: n,
              modelAAccuracy: evA?.accuracy,
              modelBAccuracy: evB?.accuracy,
              modelALatency: evA?.avg_latency_ms,
              modelBLatency: evB?.avg_latency_ms,
            };
          })}
        />
      )}
    </div>
  );
}
