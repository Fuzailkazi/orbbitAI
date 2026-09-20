"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Play, Loader2, CheckCircle2, AlertCircle, ArrowRight,
  Terminal, Sparkles, Plus, RefreshCw
} from "lucide-react";
import type { Model, Benchmark } from "@/types/database";
import { CustomBenchmarkModal } from "@/components/evaluations/custom-benchmark-modal";

interface LogEntry {
  id: string;
  time: string;
  text: string;
  type: "info" | "start" | "success" | "fail" | "complete";
}

export function EvaluateClient({
  models,
  benchmarks: initialBenchmarks,
}: {
  models: Model[];
  benchmarks: Benchmark[];
}) {
  const router = useRouter();
  const [benchmarks, setBenchmarks] = useState(initialBenchmarks);
  const defaultModelId = models.find((m) => m.api_identifier === "openai/gpt-6-astra" || m.api_identifier.includes("astra"))?.id || models[0]?.id || "";
  const [selectedModelId, setSelectedModelId] = useState(defaultModelId);
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState(initialBenchmarks[0]?.id || "");
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const selectedBenchmark = benchmarks.find((b) => b.id === selectedBenchmarkId);

  function addLog(text: string, type: LogEntry["type"] = "info") {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [...prev, { id: Math.random().toString(), time, text, type }]);
  }

  function handleCustomBenchmarkCreated(newB: any) {
    setBenchmarks((prev) => [newB, ...prev]);
    setSelectedBenchmarkId(newB.id);
    addLog(`✨ Custom benchmark "${newB.name}" loaded with ${newB.total_questions} questions.`, "info");
  }

  async function handleStartEvaluation(e: React.FormEvent) {
    e.preventDefault();
    setIsRunning(true);
    setRunResult(null);
    setErrorMessage(null);
    setLogs([]);
    setProgress({ current: 0, total: questionCount });

    addLog(`Initializing evaluation runner...`, "info");

    try {
      const res = await fetch("/api/evaluations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModelId,
          benchmarkId: selectedBenchmarkId,
          limitQuestions: questionCount,
          stream: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("Unable to read streaming response.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const rawEvent of events) {
          if (rawEvent.startsWith("data: ")) {
            try {
              const event = JSON.parse(rawEvent.slice(6));
              
              if (event.type === "init") {
                setProgress({ current: 0, total: event.totalQuestions });
                addLog(`Connected: ${event.modelName} on "${event.benchmarkName}" (${event.totalQuestions} items)`, "info");
              } else if (event.type === "question_start") {
                setProgress((p) => ({ ...p, current: event.index }));
                addLog(`[${event.index}/${event.total}] Prompt: "${event.promptSnippet}..."`, "start");
              } else if (event.type === "question_complete") {
                const badge = event.isCorrect ? "✅ Pass" : "❌ Fail";
                addLog(
                  `[${event.index}/${event.total}] ${badge} (${event.score.toFixed(2)}) | ${event.latencyMs}ms | ${event.tokens} toks | "${event.modelResponseSnippet}..."`,
                  event.isCorrect ? "success" : "fail"
                );
              } else if (event.type === "eval_complete") {
                addLog(`🎉 Benchmark completed! Final accuracy: ${event.output.accuracy}% [95% CI: ${event.output.ciLower}%–${event.output.ciUpper}%]`, "complete");
                setRunResult(event.output);
              } else if (event.type === "error") {
                addLog(`⚠️ Error: ${event.message}`, "fail");
                setErrorMessage(event.message);
              }
            } catch (parseErr) {
              console.error("Stream parse error:", parseErr);
            }
          }
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during evaluation.");
      addLog(`Fatal Error: ${err.message}`, "fail");
    } finally {
      setIsRunning(false);
    }
  }

  const percentComplete = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-[#F4F4F2] px-3 py-1 text-[11px] font-mono text-zinc-800 shadow-2xs mb-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-600 animate-pulse" />
            <span className="font-semibold tracking-tight uppercase">SPEC 02 // BENCHMARK RUNNER</span>
            <span className="text-zinc-400">•</span>
            <span className="text-zinc-600">SSE Telemetry Stream</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            Live Evaluation Console
          </h1>
          <p className="mt-1 text-sm text-zinc-600 max-w-2xl">
            Execute empirical benchmark runs against frontier models in real time. Measures exact accuracy, Wilson 95% CI bounds, latency percentiles, and token throughput.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCustomModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 py-2.5 text-xs font-mono font-medium text-zinc-800 shadow-2xs hover:bg-zinc-50 transition-all active:scale-[0.98] self-start md:self-end"
        >
          <Plus className="h-3.5 w-3.5 text-zinc-500" />
          <span>UPLOAD BENCHMARK (CSV/JSON)</span>
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="double-bezel">
            <div className="double-bezel-inner p-6">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-4 mb-6">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-zinc-950">
                    Console Test Configuration
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                    SELECT MODEL, SUITE & SAMPLE RATIO
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-black/[0.08] bg-zinc-50 text-zinc-600">
                  READY
                </span>
              </div>

              <form onSubmit={handleStartEvaluation} className="space-y-6">
                {/* Step 1: Model Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-zinc-500">
                      01 // TARGET MODEL ({models.length} AVAILABLE)
                    </label>
                    <span className="text-[10px] font-mono text-zinc-400">
                      LIVE OPENROUTER GATEWAY
                    </span>
                  </div>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    disabled={isRunning}
                    className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-xs font-mono text-zinc-900 shadow-2xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-all cursor-pointer"
                  >
                    <optgroup label="★ FRONTIER FLAGSHIPS (LATEST)">
                      {models
                        .filter((m) => {
                          const s = (m.api_identifier + " " + m.name).toLowerCase();
                          return s.includes("astra") || s.includes("fable") || s.includes("3.8") || s.includes("v4.1") || s.includes("o1") || s.includes("o3") || s.includes("r1") || s.includes("opus-4");
                        })
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            ★ {m.name} ({m.vendor}) — {m.category} • ${m.pricing_input}/M
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="CATALOG MODELS">
                      {models
                        .filter((m) => {
                          const s = (m.api_identifier + " " + m.name).toLowerCase();
                          return !(s.includes("astra") || s.includes("fable") || s.includes("3.8") || s.includes("v4.1") || s.includes("o1") || s.includes("o3") || s.includes("r1") || s.includes("opus-4"));
                        })
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.vendor}) — {m.category} • ${m.pricing_input}/M
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                {/* Step 2: Suite Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-zinc-500">
                      02 // BENCHMARK TEST SUITE
                    </label>
                    <span className="text-[10px] font-mono text-zinc-400">
                      STANDARDIZED & CUSTOM SUITES
                    </span>
                  </div>
                  <select
                    value={selectedBenchmarkId}
                    onChange={(e) => setSelectedBenchmarkId(e.target.value)}
                    disabled={isRunning}
                    className="w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-xs font-mono text-zinc-900 shadow-2xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-all cursor-pointer"
                  >
                    {benchmarks.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.category}) • {b.scoring_method} {b.source_url === "custom-upload" ? "★ CUSTOM" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 3: Sample Size */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-zinc-500">
                      03 // SAMPLE SIZE (QUESTIONS)
                    </label>
                    <span className="text-[10px] font-mono text-zinc-400">
                      WILSON SCORE RESOLUTION
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 5, 10, 25].map((count) => (
                      <button
                        type="button"
                        key={count}
                        onClick={() => setQuestionCount(count)}
                        disabled={isRunning}
                        className={`rounded-xl py-2.5 text-xs font-mono font-medium transition-all active:scale-[0.97] ${
                          questionCount === count
                            ? "bg-zinc-950 text-white shadow-2xs"
                            : "border border-black/[0.08] bg-white text-zinc-700 hover:bg-zinc-50 shadow-2xs"
                        }`}
                      >
                        {count} ITEMS
                      </button>
                    ))}
                  </div>
                </div>

                {errorMessage && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs font-mono text-rose-800">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Launch Button */}
                <button
                  type="submit"
                  disabled={isRunning}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 text-xs font-mono uppercase tracking-[0.12em] font-semibold text-white shadow-xs transition-all hover:bg-zinc-850 active:scale-[0.98] disabled:opacity-50"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                      STREAMING BENCHMARK ({progress.current}/{progress.total} PROMPTS)...
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-white" />
                      EXECUTE BENCHMARK RUN
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Live Execution Terminal - Matte CRT Instrument Finish */}
          {(isRunning || logs.length > 0) && (
            <div className="rounded-2xl border border-zinc-800 bg-[#0C0D10] text-zinc-100 shadow-2xl overflow-hidden font-mono text-xs">
              <div className="flex items-center justify-between border-b border-zinc-800/80 bg-[#12141A] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Terminal className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold text-zinc-200 text-xs tracking-tight">
                    LIVE TELEMETRY TRACE
                  </span>
                  <span className="text-[10px] text-zinc-500">•</span>
                  <span className="text-[10px] text-zinc-400">SSE CHANNEL 01</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  {isRunning && (
                    <span className="inline-flex items-center gap-1.5 text-orange-400 font-medium text-[10px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                      STREAMING
                    </span>
                  )}
                  <span className="tabular-nums font-bold text-zinc-300">{progress.current}/{progress.total} prompts</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-zinc-900 h-1">
                <div
                  className="bg-orange-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>

              {/* Terminal Logs */}
              <div className="p-4 space-y-2 max-h-72 overflow-y-auto leading-relaxed bg-[#0C0D10]">
                {logs.map((l) => (
                  <div key={l.id} className="flex items-start gap-3">
                    <span className="text-zinc-600 select-none text-[10px] shrink-0 font-mono">{l.time}</span>
                    <span
                      className={`break-all ${
                        l.type === "success"
                          ? "text-emerald-400"
                          : l.type === "fail"
                          ? "text-rose-400"
                          : l.type === "start"
                          ? "text-zinc-300"
                          : l.type === "complete"
                          ? "text-orange-400 font-bold"
                          : "text-zinc-400"
                      }`}
                    >
                      {l.text}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Details & Telemetry Preview */}
        <div className="space-y-5">
          {/* Run Specs Card */}
          <div className="double-bezel">
            <div className="double-bezel-inner p-5 space-y-4">
              <div className="border-b border-black/[0.06] pb-3">
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-zinc-400">
                  RUN SPECIFICATIONS
                </h4>
              </div>
              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">MODEL:</span>
                  <span className="font-semibold text-zinc-950 truncate max-w-[170px]">{selectedModel?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">PROVIDER:</span>
                  <span className="font-medium text-zinc-800">{selectedModel?.vendor}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">API ROUTE:</span>
                  <span className="text-[11px] text-zinc-600 truncate max-w-[150px]">
                    {selectedModel?.api_identifier}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">SUITE:</span>
                  <span className="font-medium text-zinc-800 truncate max-w-[160px]">{selectedBenchmark?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">SCORER:</span>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-zinc-800 border border-zinc-200">
                    {selectedBenchmark?.scoring_method}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Result Card */}
          {runResult && (
            <div className="double-bezel">
              <div className="double-bezel-inner p-5 space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
                  <span className="flex items-center gap-1.5 text-xs font-mono font-semibold text-zinc-950">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    RUN COMPLETE
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-800 border border-zinc-200">
                    {runResult.questionsCorrect} / {runResult.questionsEvaluated} PASS
                  </span>
                </div>
                <div className="space-y-3 font-mono">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-zinc-500">MEASURED ACCURACY:</span>
                    <span className="text-2xl font-bold text-zinc-950">
                      {runResult.accuracy}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-zinc-600">
                    <span>95% WILSON CI:</span>
                    <span className="font-semibold text-zinc-900">
                      [{runResult.ciLower}% – {runResult.ciUpper}%]
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-zinc-600">
                    <span>AVG LATENCY:</span>
                    <span className="text-zinc-900">{runResult.avgLatencyMs}ms</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-zinc-600">
                    <span>THROUGHPUT:</span>
                    <span className="text-zinc-900">{runResult.tokensPerSecond} TPS</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-zinc-600">
                    <span>COMPUTE COST:</span>
                    <span className="text-zinc-900">${runResult.totalCost.toFixed(5)}</span>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => router.push(`/dashboard/evaluations/${runResult.evaluationId}`)}
                      className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-950 text-xs font-mono uppercase tracking-wider font-semibold text-white shadow-2xs hover:bg-zinc-800 transition-all active:scale-[0.98]"
                    >
                      <span>AUDIT PROMPT DRILLDOWN</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Benchmark Modal */}
      <CustomBenchmarkModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onCreated={handleCustomBenchmarkCreated}
      />
    </div>
  );
}
