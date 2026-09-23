"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Award, Copy, Printer, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccuracyWithCI } from "@/components/evaluations/accuracy-with-ci";
import { cn } from "@/lib/utils";
import {
  formatCI,
  formatContext,
  formatCost,
  formatLatency,
  formatPct,
  formatPricePerMillion,
} from "@/lib/format";

/** Which side a statistical comparison favours. `tie` = 95% CIs overlap. */
export type ComparisonVerdict = "a" | "b" | "tie" | "unknown";

export interface ExecutiveReportAccuracy {
  accuracy: number | null;
  lower: number | null;
  upper: number | null;
}

export interface ExecutiveReportModel {
  name: string;
  vendor: string;
  context: number;
  pricingInput: number;
  pricingOutput: number;
  /** Pooled accuracy (Σ correct / Σ questions) over the shared benchmarks, with Wilson 95% CI. */
  pooled: ExecutiveReportAccuracy;
  /** Mean of per-benchmark average latency over the shared benchmarks. */
  meanLatencyMs: number | null;
}

export interface ExecutiveReportBenchmark {
  benchmark: string;
  a: ExecutiveReportAccuracy;
  b: ExecutiveReportAccuracy;
  verdict: ComparisonVerdict;
}

interface ExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelA: ExecutiveReportModel;
  modelB: ExecutiveReportModel;
  benchmarks: ExecutiveReportBenchmark[];
  /** Verdict on the pooled accuracies. */
  overall: ComparisonVerdict;
}

/** List-price projection inputs (clearly labelled as assumptions in the memo). */
const PROJECTION_REQUESTS = 1_000_000;
const PROJECTION_INPUT_TOKENS = 500;
const PROJECTION_OUTPUT_TOKENS = 200;

function projectedCost(m: ExecutiveReportModel): number {
  const perCall =
    (PROJECTION_INPUT_TOKENS * m.pricingInput + PROJECTION_OUTPUT_TOKENS * m.pricingOutput) / 1_000_000;
  return perCall * PROJECTION_REQUESTS;
}

function describeAccuracy(acc: ExecutiveReportAccuracy): string {
  if (acc.accuracy === null) return "no recorded accuracy";
  const ci = acc.lower !== null && acc.upper !== null ? ` (95% CI ${formatCI(acc.lower, acc.upper)})` : " (CI n/a)";
  return `${formatPct(acc.accuracy)}${ci}`;
}

/** Plain-text recommendation, mirroring <Recommendation> for the clipboard copy. */
function recommendationText(
  modelA: ExecutiveReportModel,
  modelB: ExecutiveReportModel,
  n: number,
  overall: ComparisonVerdict,
  costA: number,
  costB: number
): string {
  const suites = `${n} shared benchmark${n === 1 ? "" : "s"}`;
  if (n === 0 || overall === "unknown") {
    return `Not enough shared evidence to recommend either model: ${modelA.name} and ${modelB.name} have not been evaluated on a common benchmark.`;
  }
  if (overall === "a" || overall === "b") {
    const winner = overall === "a" ? modelA : modelB;
    const loser = overall === "a" ? modelB : modelA;
    return `Across ${suites}, ${winner.name} (${winner.vendor}) is recommended. Its pooled accuracy of ${describeAccuracy(winner.pooled)} is statistically higher than ${loser.name}'s ${describeAccuracy(loser.pooled)}; the 95% confidence intervals do not overlap.`;
  }
  const cheaper = costA === costB ? null : costA < costB ? modelA : modelB;
  return `Across ${suites}, the pooled accuracies of ${modelA.name} (${describeAccuracy(modelA.pooled)}) and ${modelB.name} (${describeAccuracy(modelB.pooled)}) overlap, so quality alone does not separate them. ${
    cheaper ? `${cheaper.name} is the more economical choice at list price.` : "Pricing is identical; decide on latency and context window."
  }`;
}

function Recommendation({
  modelA,
  modelB,
  benchmarks,
  overall,
  costA,
  costB,
}: {
  modelA: ExecutiveReportModel;
  modelB: ExecutiveReportModel;
  benchmarks: ExecutiveReportBenchmark[];
  overall: ComparisonVerdict;
  costA: number;
  costB: number;
}) {
  const n = benchmarks.length;

  if (n === 0 || overall === "unknown") {
    return (
      <p className="mt-1 text-sm leading-relaxed text-foreground/80">
        There is not enough shared evidence to recommend either model: <strong>{modelA.name}</strong> and{" "}
        <strong>{modelB.name}</strong> have not been evaluated on a common benchmark. Run both models on the
        same benchmark suite before making a selection.
      </p>
    );
  }

  if (overall === "a" || overall === "b") {
    const winner = overall === "a" ? modelA : modelB;
    const loser = overall === "a" ? modelB : modelA;
    return (
      <p className="mt-1 text-sm leading-relaxed text-foreground/80">
        Across {n} shared benchmark{n === 1 ? "" : "s"}, <strong>{winner.name}</strong> ({winner.vendor}) is
        recommended. Its pooled accuracy of <strong>{describeAccuracy(winner.pooled)}</strong> is
        statistically higher than {loser.name}&apos;s {describeAccuracy(loser.pooled)}; the 95% confidence
        intervals do not overlap.
      </p>
    );
  }

  const cheaper = costA === costB ? null : costA < costB ? modelA : modelB;
  return (
    <p className="mt-1 text-sm leading-relaxed text-foreground/80">
      Across {n} shared benchmark{n === 1 ? "" : "s"}, the pooled accuracies of <strong>{modelA.name}</strong>{" "}
      ({describeAccuracy(modelA.pooled)}) and <strong>{modelB.name}</strong> ({describeAccuracy(modelB.pooled)})
      overlap, so quality alone does not separate them.{" "}
      {cheaper ? (
        <>
          <strong>{cheaper.name}</strong> is the more economical choice at list price.
        </>
      ) : (
        <>Pricing is identical; decide on latency and context window.</>
      )}
    </p>
  );
}

const PRINT_ISOLATION_CSS =
  "@media print { body > *:not([data-print-memo]) { display: none !important; } body { background: var(--background) !important; } }";

export function ExecutiveReportModal({
  isOpen,
  onClose,
  modelA,
  modelB,
  benchmarks,
  overall,
}: ExecutiveReportModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const costA = projectedCost(modelA);
  const costB = projectedCost(modelB);

  const reportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const specRows: Array<{ label: string; a: string; b: string }> = [
    { label: "Provider", a: modelA.vendor, b: modelB.vendor },
    { label: "Context window", a: `${formatContext(modelA.context)} tokens`, b: `${formatContext(modelB.context)} tokens` },
    { label: "Input price", a: formatPricePerMillion(modelA.pricingInput), b: formatPricePerMillion(modelB.pricingInput) },
    { label: "Output price", a: formatPricePerMillion(modelA.pricingOutput), b: formatPricePerMillion(modelB.pricingOutput) },
    { label: "Mean latency", a: formatLatency(modelA.meanLatencyMs), b: formatLatency(modelB.meanLatencyMs) },
  ];

  async function copyMemo() {
    const lines = [
      `Model Selection Memo: ${modelA.name} vs ${modelB.name}`,
      `Prepared ${reportDate} · Orbbit`,
      "",
      "RECOMMENDATION",
      recommendationText(modelA, modelB, benchmarks.length, overall, costA, costB),
      "",
      "SPECIFICATIONS & PRICING",
      ...specRows.map((r) => `${r.label}: ${modelA.name} ${r.a} · ${modelB.name} ${r.b}`),
      `Pooled accuracy: ${modelA.name} ${describeAccuracy(modelA.pooled)} · ${modelB.name} ${describeAccuracy(modelB.pooled)}`,
      "",
      `LIST-PRICE PROJECTION (1M requests, ${PROJECTION_INPUT_TOKENS} in + ${PROJECTION_OUTPUT_TOKENS} out tokens each)`,
      `${modelA.name}: ${formatCost(costA)} · ${modelB.name}: ${formatCost(costB)}`,
      ...(benchmarks.length > 0
        ? [
            "",
            "SHARED BENCHMARK RESULTS",
            ...benchmarks.map(
              (row) => `${row.benchmark}: ${modelA.name} ${describeAccuracy(row.a)} · ${modelB.name} ${describeAccuracy(row.b)}`
            ),
          ]
        : []),
      "",
      "Accuracy shown with Wilson 95% confidence intervals.",
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Memo copied to clipboard");
    } catch {
      toast.error("Couldn't copy the memo", { description: "Use Print / Save PDF instead." });
    }
  }

  function printMemo() {
    try {
      window.print();
    } catch {
      toast.error("Couldn't open the print dialog");
    }
  }

  return createPortal(
    <div
      data-print-memo
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-xs animate-in fade-in duration-200 print:static print:block print:bg-background print:p-0 print:backdrop-blur-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{PRINT_ISOLATION_CSS}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="executive-memo-title"
        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl sm:p-8 print:max-h-none print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:p-6 print:shadow-none"
      >
        {/* Actions bar (hidden when printing) */}
        <div className="mb-6 flex items-center justify-between gap-3 border-b border-border pb-4 print:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              O
            </span>
            <span className="truncate text-sm font-semibold text-foreground">Orbbit Decision Engine</span>
            <Badge variant="outline" className="hidden border-brand/20 bg-brand/10 text-[10px] text-brand sm:inline-flex">
              Executive Memo
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={copyMemo}>
              <Copy /> Copy
            </Button>
            <Button variant="outline" size="sm" onClick={printMemo}>
              <Printer /> <span className="hidden sm:inline">Print / Save PDF</span>
              <span className="sm:hidden">Print</span>
            </Button>
            <Button ref={closeRef} variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close memo">
              <X />
            </Button>
          </div>
        </div>

        {/* Memo content */}
        <div className="space-y-6 font-sans text-foreground">
          <div className="border-b border-border pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="executive-memo-title" className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  Model Selection Memo
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {modelA.name} vs {modelB.name} · Prepared {reportDate}
                </p>
              </div>
              <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:block">
                ORBBIT-EVAL
              </span>
            </div>
          </div>

          {/* Recommendation */}
          <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 print:border-border print:bg-transparent">
            <div className="flex items-start gap-3">
              <Award className="mt-0.5 size-5 shrink-0 text-brand" />
              <div className="min-w-0">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand">Recommendation</h3>
                <Recommendation
                  modelA={modelA}
                  modelB={modelB}
                  benchmarks={benchmarks}
                  overall={overall}
                  costA={costA}
                  costB={costB}
                />
              </div>
            </div>
          </div>

          {/* Specs */}
          <section>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Specifications &amp; pricing
            </h4>
            <div className="overflow-x-auto rounded-xl border border-border text-xs">
              <table className="w-full text-left">
                <thead className="border-b border-border bg-muted/50 font-medium text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Metric</th>
                    <th className="px-3 py-2.5 font-medium">{modelA.name}</th>
                    <th className="px-3 py-2.5 font-medium">{modelB.name}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {specRows.map((r) => (
                    <tr key={r.label}>
                      <td className="px-2.5 py-2.5 sm:px-3 text-muted-foreground">{r.label}</td>
                      <td className="px-2.5 py-2.5 sm:px-3 font-mono text-foreground tabular-nums">{r.a}</td>
                      <td className="px-2.5 py-2.5 sm:px-3 font-mono text-foreground tabular-nums">{r.b}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-medium">
                    <td className="px-3 py-2.5 text-foreground">Pooled accuracy</td>
                    <td className="px-3 py-2.5">
                      <AccuracyWithCI {...modelA.pooled} size="xs" />
                    </td>
                    <td className="px-3 py-2.5">
                      <AccuracyWithCI {...modelB.pooled} size="xs" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Cost projection */}
          <section>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              List-price projection · 1M requests
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { m: modelA, cost: costA },
                { m: modelB, cost: costB },
              ].map(({ m, cost }) => (
                <div key={m.name} className="rounded-xl border border-border bg-muted/30 p-4">
                  <span className="block truncate text-xs text-muted-foreground">{m.name}</span>
                  <span className="mt-1 block font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                    {formatCost(cost)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Projection at published per-token prices, assuming {PROJECTION_INPUT_TOKENS} input +{" "}
              {PROJECTION_OUTPUT_TOKENS} output tokens per request. Not a recorded cost.
            </p>
          </section>

          {/* Benchmarks */}
          {benchmarks.length > 0 && (
            <section>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Shared benchmark results
              </h4>
              <div className="overflow-x-auto rounded-xl border border-border text-xs">
                <table className="w-full min-w-[480px] text-left">
                  <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Benchmark</th>
                      <th className="px-3 py-2 font-medium">{modelA.name}</th>
                      <th className="px-3 py-2 font-medium">{modelB.name}</th>
                      <th className="px-3 py-2 text-right font-medium">Δ (B − A)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {benchmarks.map((row) => {
                      const delta =
                        row.a.accuracy !== null && row.b.accuracy !== null ? row.b.accuracy - row.a.accuracy : null;
                      return (
                        <tr key={row.benchmark}>
                          <td className="px-3 py-2 font-medium text-foreground">{row.benchmark}</td>
                          <td className="px-3 py-2">
                            <AccuracyWithCI {...row.a} size="xs" />
                          </td>
                          <td className="px-3 py-2">
                            <AccuracyWithCI {...row.b} size="xs" />
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 text-right font-mono font-semibold tabular-nums",
                              row.verdict === "b" && "text-success",
                              row.verdict === "a" && "text-destructive",
                              (row.verdict === "tie" || row.verdict === "unknown") && "text-muted-foreground"
                            )}
                          >
                            {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} pp`}
                            {row.verdict === "tie" && (
                              <span className="block text-[10px] font-normal">not significant</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="flex flex-col gap-1 border-t border-border pt-4 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Generated by Orbbit · independent AI model evaluation</span>
            <span>Accuracy shown with Wilson 95% confidence intervals</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
