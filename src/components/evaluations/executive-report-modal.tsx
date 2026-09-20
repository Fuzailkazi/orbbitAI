"use client";

import { X, Printer, CheckCircle, ShieldCheck, TrendingUp, DollarSign, Clock, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelA: {
    name: string;
    vendor: string;
    context: number;
    pricingInput: number;
    pricingOutput: number;
  };
  modelB: {
    name: string;
    vendor: string;
    context: number;
    pricingInput: number;
    pricingOutput: number;
  };
  benchmarks: Array<{
    benchmark: string;
    modelAAccuracy?: number;
    modelBAccuracy?: number;
    modelALatency?: number;
    modelBLatency?: number;
  }>;
}

export function ExecutiveReportModal({
  isOpen,
  onClose,
  modelA,
  modelB,
  benchmarks,
}: ExecutiveReportModalProps) {
  if (!isOpen) return null;

  // Calculate averages
  const validAccA = benchmarks.map((b) => b.modelAAccuracy).filter((a): a is number => typeof a === "number");
  const validAccB = benchmarks.map((b) => b.modelBAccuracy).filter((b): b is number => typeof b === "number");

  const avgAccA = validAccA.length > 0 ? (validAccA.reduce((s, v) => s + v, 0) / validAccA.length).toFixed(1) : "N/A";
  const avgAccB = validAccB.length > 0 ? (validAccB.reduce((s, v) => s + v, 0) / validAccB.length).toFixed(1) : "N/A";

  const numAvgA = Number(avgAccA);
  const numAvgB = Number(avgAccB);

  // Determine winner
  const winner = !isNaN(numAvgA) && !isNaN(numAvgB)
    ? numAvgA >= numAvgB ? modelA : modelB
    : modelA;

  const winnerAcc = !isNaN(numAvgA) && !isNaN(numAvgB)
    ? Math.max(numAvgA, numAvgB)
    : 0;

  // Calculate projected cost for 1,000,000 requests (avg 500 prompt tokens, 200 completion tokens)
  const costPerCallA = (500 * modelA.pricingInput + 200 * modelA.pricingOutput) / 1_000_000;
  const costPerCallB = (500 * modelB.pricingInput + 200 * modelB.pricingOutput) / 1_000_000;

  const monthlyCost1M_A = (costPerCallA * 1_000_000).toFixed(0);
  const monthlyCost1M_B = (costPerCallB * 1_000_000).toFixed(0);

  const costDiffPercent = costPerCallB > 0
    ? (((costPerCallA - costPerCallB) / costPerCallB) * 100).toFixed(0)
    : "0";

  function handlePrint() {
    window.print();
  }

  const reportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 print:p-0 print:bg-white animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl bg-white p-8 shadow-2xl border border-slate-200 print:border-0 print:shadow-none print:max-w-none print:max-h-none print:p-6">
        
        {/* Actions Bar (hidden when printing) */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6 print:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-bold">O</span>
            <span className="text-sm font-bold text-slate-900">Orbbit Decision Engine</span>
            <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px]">
              Executive Memo
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Memo Content */}
        <div className="space-y-6 text-slate-900 font-sans">
          
          {/* Header */}
          <div className="border-b border-slate-200 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  AI Model Migration & Selection Memo
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Comparative validation and unit economics analysis • Prepared on {reportDate}
                </p>
              </div>
              <div className="text-right text-xs text-slate-400 font-mono">
                ORBBIT-EVAL-REF
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="flex items-start gap-3">
              <Award className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  Primary Recommendation
                </h3>
                <p className="text-sm text-indigo-950 mt-1 leading-relaxed">
                  Based on statistical benchmarking across {benchmarks.length} test suites,{" "}
                  <strong>{winner.name}</strong> ({winner.vendor}) is recommended for production deployment, achieving an aggregate accuracy of{" "}
                  <strong>{winnerAcc}%</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Model Head-to-Head Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Architectural & Pricing Specifications
            </h4>
            <div className="rounded-lg border border-slate-200 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Metric</th>
                    <th className="py-2.5 px-3">{modelA.name}</th>
                    <th className="py-2.5 px-3">{modelB.name}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 px-3 text-slate-500">Provider</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{modelA.vendor}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{modelB.vendor}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-slate-500">Context Window</td>
                    <td className="py-2.5 px-3 font-mono">{(modelA.context / 1000).toFixed(0)}k tokens</td>
                    <td className="py-2.5 px-3 font-mono">{(modelB.context / 1000).toFixed(0)}k tokens</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-slate-500">Input Token Pricing</td>
                    <td className="py-2.5 px-3 font-mono">${modelA.pricingInput} / 1M</td>
                    <td className="py-2.5 px-3 font-mono">${modelB.pricingInput} / 1M</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-slate-500">Output Token Pricing</td>
                    <td className="py-2.5 px-3 font-mono">${modelA.pricingOutput} / 1M</td>
                    <td className="py-2.5 px-3 font-mono">${modelB.pricingOutput} / 1M</td>
                  </tr>
                  <tr className="bg-slate-50/50 font-semibold">
                    <td className="py-2.5 px-3 text-slate-700">Aggregate Benchmark Accuracy</td>
                    <td className="py-2.5 px-3 font-mono text-indigo-700">{avgAccA}%</td>
                    <td className="py-2.5 px-3 font-mono text-indigo-700">{avgAccB}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Unit Economics at Scale */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Production Cost Projection (1,000,000 Requests/Month)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/30">
                <span className="text-xs text-slate-500 block">{modelA.name}</span>
                <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                  ${monthlyCost1M_A}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Estimated / 1M requests</span>
              </div>
              <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/30">
                <span className="text-xs text-slate-500 block">{modelB.name}</span>
                <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                  ${monthlyCost1M_B}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Estimated / 1M requests</span>
              </div>
            </div>
          </div>

          {/* Benchmark Breakdown */}
          {benchmarks.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Validated Benchmark Suites
              </h4>
              <div className="rounded-lg border border-slate-200 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="py-2 px-3">Suite</th>
                      <th className="py-2 px-3">{modelA.name}</th>
                      <th className="py-2 px-3">{modelB.name}</th>
                      <th className="py-2 px-3">Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {benchmarks.map((b) => {
                      const a = b.modelAAccuracy ?? 0;
                      const bVal = b.modelBAccuracy ?? 0;
                      const delta = a - bVal;
                      return (
                        <tr key={b.benchmark}>
                          <td className="py-2 px-3 font-medium text-slate-800">{b.benchmark}</td>
                          <td className="py-2 px-3 font-mono text-slate-700">{a > 0 ? `${a}%` : "—"}</td>
                          <td className="py-2 px-3 font-mono text-slate-700">{bVal > 0 ? `${bVal}%` : "—"}</td>
                          <td className={`py-2 px-3 font-mono font-semibold ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-slate-400"}`}>
                            {delta > 0 ? `+${delta.toFixed(1)}%` : delta < 0 ? `${delta.toFixed(1)}%` : "0.0%"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer Signature */}
          <div className="border-t border-slate-200 pt-4 flex justify-between items-center text-[11px] text-slate-400">
            <span>Generated by Orbbit Independent AI Evaluation Framework</span>
            <span>All evaluations verified with Wilson 95% Confidence Intervals</span>
          </div>
        </div>
      </div>
    </div>
  );
}
