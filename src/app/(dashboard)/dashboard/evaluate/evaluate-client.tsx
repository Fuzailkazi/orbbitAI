"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Play, Loader2, CheckCircle2, AlertCircle, ArrowRight,
  Cpu, Award, HelpCircle, ShieldCheck
} from "lucide-react";
import type { Model, Benchmark } from "@/types/database";

export function EvaluateClient({
  models,
  benchmarks,
}: {
  models: Model[];
  benchmarks: Benchmark[];
}) {
  const router = useRouter();
  const [selectedModelId, setSelectedModelId] = useState(models[0]?.id || "");
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState(benchmarks[0]?.id || "");
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const selectedBenchmark = benchmarks.find((b) => b.id === selectedBenchmarkId);

  async function handleStartEvaluation(e: React.FormEvent) {
    e.preventDefault();
    setIsRunning(true);
    setRunResult(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/evaluations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModelId,
          benchmarkId: selectedBenchmarkId,
          limitQuestions: questionCount,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to execute evaluation.");
      }

      setRunResult(data.data);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration Column */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-semibold text-slate-900">
                Configure Benchmark Run
              </CardTitle>
              <p className="text-xs text-slate-500">
                Select an AI model and standardized benchmark suite to test live via OpenRouter.
              </p>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleStartEvaluation} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    1. Select Model ({models.length} available)
                  </label>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    disabled={isRunning}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.vendor}) — {m.category} • ${m.pricing_input}/M in, ${m.pricing_output}/M out
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    2. Select Benchmark Suite
                  </label>
                  <select
                    value={selectedBenchmarkId}
                    onChange={(e) => setSelectedBenchmarkId(e.target.value)}
                    disabled={isRunning}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {benchmarks.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.category}) • {b.available_questions ? `${b.available_questions} questions available` : "Active"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    3. Sample Size (Questions)
                  </label>
                  <div className="flex gap-2">
                    {[5, 10, 25, 50].map((count) => (
                      <button
                        type="button"
                        key={count}
                        onClick={() => setQuestionCount(count)}
                        disabled={isRunning}
                        className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                          questionCount === count
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {count} questions
                      </button>
                    ))}
                  </div>
                </div>

                {errorMessage && (
                  <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isRunning}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Running live benchmark on OpenRouter...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-white" />
                      Start Live Evaluation
                    </>
                  )}
                </button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Details & Telemetry Preview */}
        <div className="space-y-4">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Run Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Model:</span>
                <span className="font-semibold text-slate-800">{selectedModel?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Provider:</span>
                <span className="font-medium text-slate-800">{selectedModel?.vendor}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">API Identifier:</span>
                <span className="font-mono text-[11px] text-slate-600 truncate max-w-[150px]">
                  {selectedModel?.api_identifier}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Benchmark:</span>
                <span className="font-semibold text-slate-800">{selectedBenchmark?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Scoring:</span>
                <Badge variant="outline" className="border-indigo-100 bg-indigo-50 text-[10px] text-indigo-700">
                  {selectedBenchmark?.scoring_method}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Real-time Result Card */}
          {runResult && (
            <Card className="border-emerald-200 bg-emerald-50/30 shadow-sm animate-in fade-in duration-300">
              <CardHeader className="border-b border-emerald-100 pb-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Evaluation Finished
                  </span>
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]">
                    {runResult.questionsCorrect} / {runResult.questionsEvaluated} Correct
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-600">Measured Accuracy:</span>
                  <span className="font-mono text-xl font-bold text-slate-900">
                    {runResult.accuracy}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>95% Wilson CI:</span>
                  <span className="font-mono text-slate-700">
                    {runResult.ciLower}% – {runResult.ciUpper}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Avg Latency:</span>
                  <span className="font-mono text-slate-700">{runResult.avgLatencyMs}ms</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Throughput:</span>
                  <span className="font-mono text-slate-700">{runResult.tokensPerSecond} TPS</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Total Cost:</span>
                  <span className="font-mono text-slate-700">${runResult.totalCost.toFixed(5)}</span>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => router.push(`/dashboard/evaluations/${runResult.evaluationId}`)}
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                  >
                    View Prompt Drilldown <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
