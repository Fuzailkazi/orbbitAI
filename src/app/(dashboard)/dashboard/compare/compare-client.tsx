"use client";

import { useState } from "react";
import type { Model } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitCompareArrows, Check } from "lucide-react";

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
    <div className="grid grid-cols-3 items-center border-b border-slate-50 py-3 last:border-0">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className={`text-center font-mono text-sm ${better==="a" ? "font-semibold text-emerald-600" : "text-slate-700"}`}>{a}{better==="a" && <Check className="inline h-3 w-3 ml-0.5"/>}</span>
      <span className={`text-center font-mono text-sm ${better==="b" ? "font-semibold text-emerald-600" : "text-slate-700"}`}>{b}{better==="b" && <Check className="inline h-3 w-3 ml-0.5"/>}</span>
    </div>
  );
}

export function CompareClient({ models, evaluations }: { models: Model[]; evaluations: EvalData[] }) {
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const a = models.find((m) => m.id === idA);
  const b = models.find((m) => m.id === idB);
  const eA = evaluations.filter((e) => e.model_id === idA);
  const eB = evaluations.filter((e) => e.model_id === idB);
  const namesA = new Set(eA.map((e) => (e.benchmarks as unknown as {name:string})?.name).filter(Boolean));
  const shared = [...namesA].filter((n) => eB.some((e) => (e.benchmarks as unknown as {name:string})?.name === n));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Compare Models</h1>
        <p className="mt-1 text-sm text-slate-500">Select two models to compare side-by-side.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {([["A",idA,idB,setIdA],["B",idB,idA,setIdB]] as const).map(([label,val,other,set]) => (
          <Card key={label} className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">Model {label}</CardTitle></CardHeader>
            <CardContent>
              <select value={val} onChange={(e) => set(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <option value="">Select a model...</option>
                {models.map((m) => (<option key={m.id} value={m.id} disabled={m.id===other}>{m.name} ({m.vendor})</option>))}
              </select>
            </CardContent>
          </Card>
        ))}
      </div>
      {a && b ? (
        <>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center gap-2 border-b border-slate-100"><GitCompareArrows className="h-4 w-4 text-slate-400"/><CardTitle className="text-sm font-semibold text-slate-900">Specs</CardTitle></CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-3 items-center border-b border-slate-100 pb-3 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Metric</span>
                <div className="text-center"><p className="text-sm font-semibold text-slate-900">{a.name}</p><p className="text-[10px] text-slate-400">{a.vendor}</p></div>
                <div className="text-center"><p className="text-sm font-semibold text-slate-900">{b.name}</p><p className="text-[10px] text-slate-400">{b.vendor}</p></div>
              </div>
              <Row label="Category" a={a.category} b={b.category} better="tie"/>
              <Row label="Context" a={fmt(a.context_window)} b={fmt(b.context_window)} better={a.context_window>b.context_window?"a":a.context_window<b.context_window?"b":"tie"}/>
              <Row label="Input Price" a={fmtP(a.pricing_input)} b={fmtP(b.pricing_input)} better={a.pricing_input<b.pricing_input?"a":a.pricing_input>b.pricing_input?"b":"tie"}/>
              <Row label="Output Price" a={fmtP(a.pricing_output)} b={fmtP(b.pricing_output)} better={a.pricing_output<b.pricing_output?"a":a.pricing_output>b.pricing_output?"b":"tie"}/>
            </CardContent>
          </Card>
          {shared.length > 0 && (
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-row items-center gap-2 border-b border-slate-100"><GitCompareArrows className="h-4 w-4 text-slate-400"/><CardTitle className="text-sm font-semibold text-slate-900">Benchmark Accuracy</CardTitle></CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-3 items-center border-b border-slate-100 pb-3 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Benchmark</span>
                  <span className="text-center text-xs font-semibold text-slate-700">{a.name}</span>
                  <span className="text-center text-xs font-semibold text-slate-700">{b.name}</span>
                </div>
                {shared.map((bench) => {
                  const accA = eA.find((e) => (e.benchmarks as unknown as {name:string})?.name === bench)?.accuracy ?? 0;
                  const accB = eB.find((e) => (e.benchmarks as unknown as {name:string})?.name === bench)?.accuracy ?? 0;
                  return <Row key={bench} label={bench} a={`${accA.toFixed(1)}%`} b={`${accB.toFixed(1)}%`} better={accA>accB?"a":accA<accB?"b":"tie"}/>;
                })}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GitCompareArrows className="h-8 w-8 text-slate-300 mb-3"/>
            <p className="text-sm text-slate-500">Select two models above to compare them.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
