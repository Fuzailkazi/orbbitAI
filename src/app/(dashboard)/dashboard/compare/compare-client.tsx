"use client";

import { useState } from "react";
import type { Model } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitCompareArrows, Check, Download, Share2, Copy, FileText } from "lucide-react";
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
    <div className="grid grid-cols-3 items-center border-b border-black/[0.04] py-3.5 last:border-0">
      <span className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
      <div className="text-center font-mono text-sm">
        <span className={`${better === "a" ? "font-bold text-zinc-950 bg-zinc-100 border border-zinc-300 px-2 py-0.5 rounded shadow-2xs inline-flex items-center gap-1" : "text-zinc-600"}`}>
          {a}
          {better === "a" && <Check className="h-3 w-3 text-zinc-950 stroke-[2.5]" />}
        </span>
      </div>
      <div className="text-center font-mono text-sm">
        <span className={`${better === "b" ? "font-bold text-zinc-950 bg-zinc-100 border border-zinc-300 px-2 py-0.5 rounded shadow-2xs inline-flex items-center gap-1" : "text-zinc-600"}`}>
          {b}
          {better === "b" && <Check className="h-3 w-3 text-zinc-950 stroke-[2.5]" />}
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
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-[#F4F4F2] px-3 py-1 text-[11px] font-mono text-zinc-800 shadow-2xs mb-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-600 animate-pulse" />
            <span className="font-semibold tracking-tight uppercase">SPEC 03 // DIFFERENTIAL MATRIX</span>
            <span className="text-zinc-400">•</span>
            <span className="text-zinc-600">Side-by-Side Analysis</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            Head-to-Head Comparison
          </h1>
          <p className="mt-1 text-sm text-zinc-600 max-w-2xl">
            Select two frontier models to cross-examine benchmark deltas, architectural context windows, and token pricing economics.
          </p>
        </div>
        {a && b && (
          <div className="flex items-center gap-2 self-start sm:self-end">
            <button
              onClick={() => setIsReportOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-3.5 py-2 text-xs font-mono uppercase tracking-wider font-semibold text-white shadow-2xs hover:bg-zinc-800 transition-all active:scale-[0.98]"
            >
              <FileText className="h-3.5 w-3.5 text-orange-500" /> Executive Memo
            </button>
            <button
              onClick={copyShareUrl}
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs font-mono font-medium text-zinc-800 shadow-2xs hover:bg-zinc-50 transition-all active:scale-[0.98]"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
              {copied ? "COPIED" : "SHARE"}
            </button>
            <button
              onClick={exportComparisonJson}
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-xs font-mono font-medium text-zinc-800 shadow-2xs hover:bg-zinc-50 transition-all active:scale-[0.98]"
            >
              <Download className="h-3.5 w-3.5 text-zinc-400" /> JSON
            </button>
          </div>
        )}
      </div>

      {/* Selector Cards - Double Bezel Rack */}
      <div className="grid gap-5 sm:grid-cols-2">
        {([["A", idA, idB, setIdA, "SLOT 01 // BASELINE MODEL"], ["B", idB, idA, setIdB, "SLOT 02 // CANDIDATE MODEL"]] as const).map(([label, val, other, set, tag]) => (
          <div key={label} className="double-bezel">
            <div className="double-bezel-inner p-5">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 mb-4">
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-400 font-bold">
                  {tag}
                </span>
                <span className="font-mono text-xs font-bold text-zinc-950 px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200">
                  MODEL {label}
                </span>
              </div>
              <select
                value={val}
                onChange={(e) => set(e.target.value)}
                className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-xs font-mono text-zinc-900 shadow-2xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-all cursor-pointer"
              >
                <option value="">SELECT TARGET MODEL...</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id} disabled={m.id === other}>
                    {m.name} ({m.vendor}) — {m.category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {a && b ? (
        <div className="space-y-6">
          {/* Hardware Specifications Comparison Card */}
          <div className="double-bezel">
            <div className="double-bezel-inner p-6">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <GitCompareArrows className="h-4 w-4 text-zinc-900" />
                  <h3 className="text-sm font-semibold tracking-tight text-zinc-950">
                    Architectural Specifications & Pricing
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  EMPIRICAL DELTA
                </span>
              </div>

              {/* Table Column Labels */}
              <div className="grid grid-cols-3 items-center border-b border-black/[0.06] pb-3 mb-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-400">Parameter</span>
                <div className="text-center">
                  <p className="text-xs font-semibold text-zinc-950">{a.name}</p>
                  <p className="text-[10px] font-mono text-zinc-400 uppercase">{a.vendor}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-zinc-950">{b.name}</p>
                  <p className="text-[10px] font-mono text-zinc-400 uppercase">{b.vendor}</p>
                </div>
              </div>

              <Row label="Category" a={a.category} b={b.category} better="tie" />
              <Row label="Context Window" a={fmt(a.context_window)} b={fmt(b.context_window)} better={a.context_window > b.context_window ? "a" : a.context_window < b.context_window ? "b" : "tie"} />
              <Row label="Input Price / 1M" a={fmtP(a.pricing_input)} b={fmtP(b.pricing_input)} better={a.pricing_input < b.pricing_input ? "a" : a.pricing_input > b.pricing_input ? "b" : "tie"} />
              <Row label="Output Price / 1M" a={fmtP(a.pricing_output)} b={fmtP(b.pricing_output)} better={a.pricing_output < b.pricing_output ? "a" : a.pricing_output > b.pricing_output ? "b" : "tie"} />
            </div>
          </div>

          {/* Shared Benchmark Cross-Accuracy Card */}
          {shared.length > 0 && (
            <>
              <div className="double-bezel">
                <div className="double-bezel-inner p-6">
                  <div className="flex items-center justify-between border-b border-black/[0.06] pb-4 mb-4">
                    <div className="flex items-center gap-2">
                      <GitCompareArrows className="h-4 w-4 text-zinc-900" />
                      <h3 className="text-sm font-semibold tracking-tight text-zinc-950">
                        Cross-Benchmark Measured Accuracy
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {shared.length} SHARED TEST SUITES
                    </span>
                  </div>

                  <div className="grid grid-cols-3 items-center border-b border-black/[0.06] pb-3 mb-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-400">Test Suite</span>
                    <span className="text-center text-xs font-mono font-semibold text-zinc-800">{a.name}</span>
                    <span className="text-center text-xs font-mono font-semibold text-zinc-800">{b.name}</span>
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
              </div>

              {shared.length >= 3 && (
                <div className="double-bezel">
                  <div className="double-bezel-inner p-6">
                    <div className="flex items-center justify-between border-b border-black/[0.06] pb-4 mb-5">
                      <div className="flex items-center gap-2">
                        <GitCompareArrows className="h-4 w-4 text-zinc-900" />
                        <h3 className="text-sm font-semibold tracking-tight text-zinc-950">
                          Multi-Dimensional Capability Radar
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">
                        RADAR PROJECTION
                      </span>
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
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="double-bezel">
          <div className="double-bezel-inner flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="h-12 w-12 rounded-2xl bg-zinc-100 border border-black/[0.06] flex items-center justify-center text-zinc-400 mb-4 shadow-2xs">
              <GitCompareArrows className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-zinc-900">AWAITING MODEL SELECTION</p>
            <p className="text-xs text-zinc-500 font-mono mt-1 max-w-sm">
              Select two target models in Slot 01 and Slot 02 above to compute differential benchmark accuracy, context size, and token costs.
            </p>
          </div>
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
