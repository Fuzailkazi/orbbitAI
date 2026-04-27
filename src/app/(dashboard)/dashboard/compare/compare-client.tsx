"use client";

import { useState } from "react";
import type { Model } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitCompareArrows, Check, X, Minus } from "lucide-react";

function formatCtx(ctx: number): string {
  if (ctx >= 1000000) return `${(ctx / 1000000).toFixed(1)}M`;
  return `${(ctx / 1000).toFixed(0)}K`;
}

function formatPrice(p: number): string {
  return p === 0 ? "Free" : `$${p}`;
}

function CompareRow({ label, valueA, valueB, better }: {
  label: string;
  valueA: string;
  valueB: string;
  better: "a" | "b" | "tie";
}) {
  return (
    <div className="grid grid-cols-3 items-center border-b border-slate-50 py-3 last:border-0">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className={`text-center font-mono text-sm ${better === "a" ? "font-semibold text-emerald-600" : "text-slate-700"}`}>
        {valueA} {better === "a" && <Check className="inline h-3 w-3 ml-0.5" />}
      </span>
      <span className={`text-center font-mono text-sm ${better === "b" ? "font-semibold text-emerald-600" : "text-slate-700"}`}>
        {valueB} {better === "b" && <Check className="inline h-3 w-3 ml-0.5" />}
      </span>
    </div>
  );
}

export function CompareClient({ models }: { models: Model[] }) {
  const [modelA, setModelA] = useState<string>("");
  const [modelB, setModelB] = useState<string>("");

  const a = models.find((m) => m.id === modelA);
  const b = models.find((m) => m.id === modelB);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Compare Models</h1>
        <p className="mt-1 text-sm text-slate-500">Select two models to compare side-by-side.</p>
      </div>

      {/* Model selectors */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">Model A</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              value={modelA}
              onChange={(e) => setModelA(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
            >
              <option value="">Select a model...</option>
              {models.map((m) => (
                <option key={m.id} value={m.id} disabled={m.id === modelB}>
                  {m.name} ({m.vendor})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">Model B</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              value={modelB}
              onChange={(e) => setModelB(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
            >
              <option value="">Select a model...</option>
              {models.map((m) => (
                <option key={m.id} value={m.id} disabled={m.id === modelA}>
                  {m.name} ({m.vendor})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      </div>

      {/* Comparison table */}
      {a && b ? (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 border-b border-slate-100">
            <GitCompareArrows className="h-4 w-4 text-slate-400" />
            <CardTitle className="text-sm font-semibold text-slate-900">Side-by-Side Comparison</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {/* Header row */}
            <div className="grid grid-cols-3 items-center border-b border-slate-100 pb-3 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Metric</span>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-900">{a.name}</p>
                <p className="text-[10px] text-slate-400">{a.vendor}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-900">{b.name}</p>
                <p className="text-[10px] text-slate-400">{b.vendor}</p>
              </div>
            </div>

            <CompareRow
              label="Category"
              valueA={a.category}
              valueB={b.category}
              better="tie"
            />
            <CompareRow
              label="Context Window"
              valueA={formatCtx(a.context_window)}
              valueB={formatCtx(b.context_window)}
              better={a.context_window > b.context_window ? "a" : a.context_window < b.context_window ? "b" : "tie"}
            />
            <CompareRow
              label="Input Price"
              valueA={formatPrice(a.pricing_input)}
              valueB={formatPrice(b.pricing_input)}
              better={a.pricing_input < b.pricing_input ? "a" : a.pricing_input > b.pricing_input ? "b" : "tie"}
            />
            <CompareRow
              label="Output Price"
              valueA={formatPrice(a.pricing_output)}
              valueB={formatPrice(b.pricing_output)}
              better={a.pricing_output < b.pricing_output ? "a" : a.pricing_output > b.pricing_output ? "b" : "tie"}
            />
            <CompareRow
              label="Released"
              valueA={a.release_date ? new Date(a.release_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
              valueB={b.release_date ? new Date(b.release_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
              better={
                a.release_date && b.release_date
                  ? a.release_date > b.release_date ? "a" : a.release_date < b.release_date ? "b" : "tie"
                  : "tie"
              }
            />

            {/* Accuracy comparison placeholder */}
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
              <p className="text-xs text-slate-400">
                Accuracy, latency, and cost-per-token comparisons will appear after running evaluations (Phase 4).
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitCompareArrows className="h-8 w-8 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">Select two models above to compare them.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
