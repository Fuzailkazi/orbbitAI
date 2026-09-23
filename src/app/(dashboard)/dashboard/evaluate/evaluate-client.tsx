"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Play,
  Terminal,
  Upload,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ModelPicker, type ModelPickerModel } from "@/components/models/model-picker";
import { AccuracyWithCI } from "@/components/evaluations/accuracy-with-ci";
import type { CreatedBenchmark } from "@/components/evaluations/custom-benchmark-modal";
import {
  formatCost,
  formatLatency,
  formatModelName,
  formatNumber,
  formatPct,
  formatTokens,
  formatVendor,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The upload dialog (and its CSV/JSON parsing) is only needed after a click, so it is split out
 * of the page bundle. It renders nothing while closed, so skipping SSR changes no markup.
 */
const CustomBenchmarkModal = dynamic(
  () => import("@/components/evaluations/custom-benchmark-modal").then((m) => m.CustomBenchmarkModal),
  { ssr: false }
);

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface EvaluateModel extends ModelPickerModel {
  context_window: number | null;
}

export interface EvaluateBenchmark {
  id: string;
  name: string;
  description: string | null;
  category: string;
  scoring_method: string;
  total_questions: number;
  source_url: string | null;
  /** Prompts actually seeded in `benchmark_questions` (the most a run can use). */
  available_questions: number;
}

type LogType = "info" | "start" | "pass" | "fail" | "error" | "complete";

interface LogEntry {
  id: number;
  time: string;
  text: string;
  type: LogType;
}

type RunStatus = "idle" | "running" | "complete" | "failed";

interface RunTally {
  passed: number;
  incorrect: number;
  errored: number;
}

interface RunOutput {
  evaluationId: string;
  /** Server verdict: `failed` when no prompt produced a usable response. */
  status: "completed" | "failed";
  /** null when the run failed — zero successful calls carry no accuracy signal. */
  accuracy: number | null;
  ciLower: number | null;
  ciUpper: number | null;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  totalTokens: number | null;
  totalCost: number | null;
  tokensPerSecond: number | null;
  questionsEvaluated: number;
  questionsCorrect: number;
  /** 0–100. From the server when it reports it, otherwise derived from the streamed events. */
  failureRate: number;
  failedCount: number;
  questionsRequested: number;
  /** The server's wall-clock budget stopped the run before every requested prompt ran. */
  truncated: boolean;
  /** Server-provided reason when status is `failed`. */
  error: string | null;
}

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const SAMPLE_SIZES = [3, 5, 10, 25] as const;

/**
 * Free models to pre-select when present (checked live on OpenRouter 2026-09-23); otherwise the
 * first free model wins. The default judge (google/gemma-4-31b-it:free) is deliberately not
 * first, so a judged benchmark is not graded by the model under test by default.
 */
const PREFERRED_DEFAULTS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen/qwen3.8-27b:free",
  "z-ai/glm-5.2:free",
];

const CUSTOM_SOURCE = "custom-upload";

/** Log tones on the dark code surface: semantic tokens lifted toward white for contrast. */
const LOG_TONE: Record<LogType, string> = {
  info: "text-code-muted",
  start: "text-code-foreground/80",
  pass: "text-[color-mix(in_oklab,var(--success)_55%,white)]",
  fail: "text-[color-mix(in_oklab,var(--destructive)_60%,white)]",
  error: "text-[color-mix(in_oklab,var(--warning)_60%,white)]",
  complete: "font-semibold text-[color-mix(in_oklab,var(--brand)_60%,white)]",
};

const STATUS_BADGE: Record<RunStatus, { label: string; className: string }> = {
  idle: { label: "Ready", className: "border-border bg-muted text-muted-foreground" },
  running: { label: "Running", className: "border-brand/20 bg-brand/10 text-brand" },
  complete: { label: "Complete", className: "border-success/20 bg-success/10 text-success" },
  failed: {
    label: "Failed",
    className: "border-destructive/20 bg-destructive/10 text-destructive",
  },
};

const LABEL_CLASS =
  "text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground";

const SELECT_CLASS =
  "h-10 w-full min-w-0 cursor-pointer rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-2xs outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

function isFreeModel(m: ModelPickerModel): boolean {
  return m.api_identifier.endsWith(":free");
}

function pickDefaultModelId(models: readonly EvaluateModel[]): string {
  const free = models.filter(isFreeModel);
  for (const apiId of PREFERRED_DEFAULTS) {
    const hit = free.find((m) => m.api_identifier === apiId);
    if (hit) return hit.id;
  }
  return free[0]?.id ?? "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function num(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return typeof v === "string" ? v : "";
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** A streamed `question_complete` counts as an API failure (not a wrong answer). */
function isFailedCall(event: Record<string, unknown>): boolean {
  if (event.failed === true) return true;
  if (typeof event.error === "string" && event.error.length > 0) return true;
  return str(event, "modelResponseSnippet").startsWith("[Failed");
}

function parseRunOutput(raw: unknown, tally: RunTally): RunOutput | null {
  const o = asRecord(raw);
  if (!o) return null;
  const evaluated = num(o, "questionsEvaluated") ?? tally.passed + tally.incorrect + tally.errored;
  const failedCount = num(o, "failedRequests") ?? num(o, "failedCount") ?? tally.errored;
  const serverRate = num(o, "failureRate");
  // Trust the server's status; also treat "every attempted call failed" as failed defensively.
  const noSignal = evaluated === 0 || failedCount >= evaluated;
  const status = str(o, "status") === "failed" || noSignal ? "failed" : "completed";
  return {
    evaluationId: str(o, "evaluationId"),
    status,
    accuracy: status === "failed" ? null : num(o, "accuracy"),
    ciLower: num(o, "ciLower"),
    ciUpper: num(o, "ciUpper"),
    avgLatencyMs: num(o, "avgLatencyMs"),
    p95LatencyMs: num(o, "p95LatencyMs"),
    totalTokens: num(o, "totalTokens"),
    totalCost: num(o, "totalCost"),
    tokensPerSecond: num(o, "tokensPerSecond"),
    questionsEvaluated: evaluated,
    questionsCorrect: num(o, "questionsCorrect") ?? tally.passed,
    failedCount,
    failureRate: serverRate ?? (evaluated > 0 ? (failedCount / evaluated) * 100 : 0),
    questionsRequested: num(o, "questionsRequested") ?? evaluated,
    truncated: o.truncated === true,
    error: str(o, "error") || null,
  };
}

function clockTime(): string {
  return new Date().toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function EvaluateClient({
  models,
  benchmarks: initialBenchmarks,
  initialModelId,
  requestedPaidModelName,
}: {
  models: EvaluateModel[];
  benchmarks: EvaluateBenchmark[];
  /** Preselected model from `?model=<id>`; ignored unless it is a free model. */
  initialModelId?: string;
  /** Name of a paid model that was deep-linked but cannot run on the free tier. */
  requestedPaidModelName?: string;
}) {
  const freeModels = models.filter(isFreeModel);

  const [benchmarks, setBenchmarks] = useState(initialBenchmarks);
  const [selectedModelId, setSelectedModelId] = useState(() =>
    initialModelId && freeModels.some((m) => m.id === initialModelId)
      ? initialModelId
      : pickDefaultModelId(models)
  );
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState(
    () => (initialBenchmarks.find((b) => b.available_questions > 0) ?? initialBenchmarks[0])?.id ?? ""
  );
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [runResult, setRunResult] = useState<RunOutput | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [tally, setTally] = useState<RunTally>({ passed: 0, incorrect: 0, errored: 0 });
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  // Mounted on first intent (hover/focus/touch of the upload button) so the chunk is usually
  // loaded before the click, then kept mounted so its close transition still plays.
  const [isCustomModalMounted, setIsCustomModalMounted] = useState(false);

  const logSeq = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Keep the trace pinned to the newest line without scrolling the whole page.
  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const isRunning = status === "running";
  const selectedModel = freeModels.find((m) => m.id === selectedModelId);
  const selectedBenchmark = benchmarks.find((b) => b.id === selectedBenchmarkId);
  const available = selectedBenchmark?.available_questions ?? 0;
  const effectiveCount = available > 0 ? Math.min(questionCount, available) : 0;
  const isCapped = available > 0 && questionCount > available;
  const canRun = !isRunning && !!selectedModel && !!selectedBenchmark && effectiveCount > 0;

  const standardBenchmarks = benchmarks.filter((b) => b.source_url !== CUSTOM_SOURCE);
  const customBenchmarks = benchmarks.filter((b) => b.source_url === CUSTOM_SOURCE);

  function addLog(text: string, type: LogType = "info") {
    logSeq.current += 1;
    const entry: LogEntry = { id: logSeq.current, time: clockTime(), text, type };
    setLogs((prev) => [...prev, entry]);
  }

  function handleCustomBenchmarkCreated(created: CreatedBenchmark) {
    const next: EvaluateBenchmark = {
      id: created.id,
      name: created.name,
      description: null,
      category: created.category,
      scoring_method: created.scoring_method,
      total_questions: created.total_questions,
      source_url: CUSTOM_SOURCE,
      available_questions: created.total_questions,
    };
    setBenchmarks((prev) => [next, ...prev.filter((b) => b.id !== next.id)]);
    setSelectedBenchmarkId(next.id);
    addLog(`Custom benchmark "${next.name}" loaded with ${next.total_questions} prompts.`);
  }

  async function handleStartEvaluation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canRun || !selectedModel || !selectedBenchmark) return;

    const local: RunTally = { passed: 0, incorrect: 0, errored: 0 };
    // Prompts run concurrently on the server, so completions can arrive out of question order:
    // progress counts completed question indices instead of trusting the latest index.
    const completedIndices = new Set<number>();
    // Mutated from the stream callback; an object avoids stale control-flow narrowing.
    const run: { output: RunOutput | null; error: string | null } = { output: null, error: null };

    setStatus("running");
    setRunResult(null);
    setErrorText(null);
    setLogs([]);
    setTally(local);
    setProgress({ current: 0, total: effectiveCount });
    addLog(
      `Queued ${formatModelName(selectedModel.name)} on ${selectedBenchmark.name} (${effectiveCount} prompts, ${selectedBenchmark.scoring_method}).`
    );

    const handleEvent = (raw: unknown) => {
      const event = asRecord(raw);
      if (!event) return;
      const type = str(event, "type");
      const index = num(event, "index") ?? 0;
      const total = num(event, "total") ?? effectiveCount;

      if (type === "init") {
        const totalQuestions = num(event, "totalQuestions") ?? effectiveCount;
        setProgress({ current: 0, total: totalQuestions });
        addLog(
          `Connected: ${formatModelName(str(event, "modelName"))} on "${str(event, "benchmarkName")}" (${totalQuestions} prompts)`
        );
        return;
      }

      if (type === "question_start") {
        addLog(`[${index}/${total}] Prompt: "${str(event, "promptSnippet")}…"`, "start");
        return;
      }

      if (type === "question_complete") {
        if (index > 0) {
          if (completedIndices.has(index)) return; // never count a prompt twice
          completedIndices.add(index);
        }
        const snippet = str(event, "modelResponseSnippet");
        if (isFailedCall(event)) {
          local.errored += 1;
          const reason = str(event, "error") || snippet;
          const what = event.unscored === true ? "Response could not be scored" : "API call failed";
          addLog(
            `[${index}/${total}] ERROR  ${what}; excluded from accuracy, counted in the failure rate. ${reason}`,
            "error"
          );
        } else {
          const correct = event.isCorrect === true;
          if (correct) local.passed += 1;
          else local.incorrect += 1;
          const score = num(event, "score") ?? 0;
          addLog(
            `[${index}/${total}] ${correct ? "PASS" : "FAIL"}  score ${score.toFixed(2)} · ${formatLatency(num(event, "latencyMs"))} · ${formatNumber(num(event, "tokens"))} tok · "${snippet}…"`,
            correct ? "pass" : "fail"
          );
        }
        setTally({ ...local });
        const done = local.passed + local.incorrect + local.errored;
        setProgress((p) => ({ ...p, current: Math.max(p.current, done) }));
        return;
      }

      if (type === "truncated") {
        addLog(`STOPPED  ${str(event, "message") || "Run time limit reached."}`, "error");
        return;
      }

      if (type === "eval_complete") {
        const output = parseRunOutput(event.output, local);
        if (!output) return;
        run.output = output;
        // A truncated run stops short: keep the counter honest (e.g. 2/10), not 10/10.
        setProgress((p) => ({ ...p, current: output.truncated ? output.questionsEvaluated : p.total }));
        setRunResult(output);
        if (output.status === "failed") {
          addLog(
            `Run failed. ${output.error ?? `${output.failedCount}/${output.questionsEvaluated} prompts failed or were unscored (${formatPct(output.failureRate)}).`} No accuracy recorded.`,
            "error"
          );
        } else {
          addLog(
            `Run complete. Accuracy ${formatPct(output.accuracy)} (95% Wilson CI ${formatPct(output.ciLower)}–${formatPct(output.ciUpper)}), ${output.failedCount} failed/unscored prompt${output.failedCount === 1 ? "" : "s"} excluded.`,
            "complete"
          );
        }
        return;
      }

      if (type === "error") {
        run.error = str(event, "message") || "The evaluation failed.";
        addLog(`ERROR  ${run.error}`, "error");
      }
    };

    try {
      const res = await fetch("/api/evaluations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModel.id,
          benchmarkId: selectedBenchmark.id,
          limitQuestions: effectiveCount,
          stream: true,
        }),
      });

      if (!res.ok) {
        const body = asRecord(await res.json().catch(() => null));
        const message = body ? str(body, "error") : "";
        throw new Error(message || `Server responded with status ${res.status}.`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Unable to read the streaming response.");

      const decoder = new TextDecoder();
      let buffer = "";

      const flush = (chunks: string[]) => {
        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          try {
            handleEvent(JSON.parse(line.slice(5).trim()));
          } catch (parseErr) {
            console.error("Stream parse error:", parseErr);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        flush(chunks);
      }
      buffer += decoder.decode();
      if (buffer.trim()) flush([buffer]);

      if (run.error) throw new Error(run.error);
      const output = run.output;
      if (!output) {
        throw new Error(
          "The stream closed before the run finished. Any partial results are listed under Evaluations."
        );
      }

      if (output.status === "failed") {
        const message =
          output.error ??
          `All ${output.questionsEvaluated} model API calls failed, so no accuracy was recorded.`;
        setErrorText(message);
        setStatus("failed");
        toast.error("Evaluation failed", {
          description: `${output.failedCount}/${output.questionsEvaluated} calls failed (${formatPct(output.failureRate)} failure rate).`,
        });
        return;
      }

      setStatus("complete");
      if (output.truncated) {
        toast.warning("Run stopped at the time limit", {
          description: `Scored ${output.questionsEvaluated} of ${output.questionsRequested} prompts; the confidence interval covers the prompts that ran.`,
        });
      } else {
        toast.success("Evaluation complete", {
          description: `${output.questionsCorrect}/${output.questionsEvaluated} correct. Results are saved prompt by prompt.`,
        });
      }
    } catch (err: unknown) {
      const message = errorMessage(err, "An unexpected error occurred during the evaluation.");
      if (!run.error) addLog(`ERROR  ${message}`, "error");
      setErrorText(message);
      setStatus("failed");
      toast.error("Evaluation failed", { description: message });
    }
  }

  const percentComplete =
    progress.total > 0 ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0;
  const badge = STATUS_BADGE[status];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-16">
      {/* Page header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Run evaluation</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Stream a live benchmark run against a free OpenRouter model. Every prompt is scored and
            stored, and accuracy is reported with its Wilson 95% confidence interval.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => {
            setIsCustomModalMounted(true);
            setIsCustomModalOpen(true);
          }}
          onPointerEnter={() => setIsCustomModalMounted(true)}
          onFocus={() => setIsCustomModalMounted(true)}
          disabled={isRunning}
          className="self-start px-3.5 md:self-auto"
        >
          <Upload data-icon="inline-start" />
          Upload benchmark
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration column */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Evaluation configuration
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Choose a model, a benchmark suite and a sample size.
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-md border px-2.5 py-0.5 text-xs font-medium",
                  badge.className
                )}
              >
                {badge.label}
              </span>
            </div>

            <form onSubmit={handleStartEvaluation} className="space-y-6">
              {/* 01 — Model */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <label htmlFor="eval-model" className={LABEL_CLASS}>
                    01 · Target model
                  </label>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {freeModels.length} free {freeModels.length === 1 ? "model" : "models"} · OpenRouter
                  </span>
                </div>
                {freeModels.length > 0 ? (
                  <ModelPicker
                    id="eval-model"
                    models={freeModels}
                    value={selectedModelId}
                    onValueChange={(value) => setSelectedModelId(value)}
                    filter={isFreeModel}
                    groupByVendor
                    disabled={isRunning}
                    placeholder="Select a free model…"
                    searchPlaceholder="Search free models…"
                    aria-label="Target model"
                  />
                ) : (
                  <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border bg-muted/50 p-3.5 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      No free (<span className="font-mono">:free</span>) models are in the catalog
                      yet. Live evaluations only run on OpenRouter&apos;s free tier. Sync the catalog
                      from OpenRouter to import them.
                    </p>
                  </div>
                )}
                {requestedPaidModelName && freeModels.length > 0 && (
                  <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {`${formatModelName(requestedPaidModelName)} is a paid model. Live runs use OpenRouter's free tier only, so a free model is selected instead.`}
                    </span>
                  </p>
                )}
              </div>

              {/* 02 — Benchmark */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <label htmlFor="eval-benchmark" className={LABEL_CLASS}>
                    02 · Benchmark suite
                  </label>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {benchmarks.length} suites · scorer fixed per benchmark
                  </span>
                </div>
                <select
                  id="eval-benchmark"
                  value={selectedBenchmarkId}
                  onChange={(e) => setSelectedBenchmarkId(e.target.value)}
                  disabled={isRunning || benchmarks.length === 0}
                  className={SELECT_CLASS}
                >
                  {benchmarks.length === 0 && <option value="">No benchmarks available</option>}
                  {customBenchmarks.length > 0 && (
                    <optgroup label="Custom uploads">
                      {customBenchmarks.map((b) => (
                        <BenchmarkOption key={b.id} benchmark={b} />
                      ))}
                    </optgroup>
                  )}
                  {standardBenchmarks.length > 0 && (
                    <optgroup label="Standard benchmarks">
                      {standardBenchmarks.map((b) => (
                        <BenchmarkOption key={b.id} benchmark={b} />
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* 03 — Sample size */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span id="eval-sample-label" className={LABEL_CLASS}>
                    03 · Sample size
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {available} {available === 1 ? "prompt" : "prompts"} available
                  </span>
                </div>
                <div
                  role="group"
                  aria-labelledby="eval-sample-label"
                  className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                >
                  {SAMPLE_SIZES.map((count) => {
                    const active = questionCount === count;
                    return (
                      <button
                        type="button"
                        key={count}
                        onClick={() => setQuestionCount(count)}
                        disabled={isRunning}
                        aria-pressed={active}
                        className={cn(
                          "h-10 rounded-lg border font-mono text-xs font-medium tabular-nums shadow-2xs outline-none transition-all active:scale-[0.97] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-foreground/80 hover:bg-muted"
                        )}
                      >
                        {count} prompts
                      </button>
                    );
                  })}
                </div>
                {isCapped && (
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                    <span>
                      This run will use {available} {available === 1 ? "prompt" : "prompts"}, which is
                      all that is imported for {selectedBenchmark?.name}. Small samples give wide
                      confidence intervals.
                    </span>
                  </p>
                )}
                {selectedBenchmark && available === 0 && (
                  <p className="flex items-start gap-1.5 text-xs text-warning">
                    <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                    <span>
                      {selectedBenchmark.name} is not runnable yet: no real benchmark questions have
                      been imported for it.
                    </span>
                  </p>
                )}
              </div>

              {errorText && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive"
                >
                  <AlertCircle className="mt-px h-4 w-4 shrink-0" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{errorText}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!canRun}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs outline-none transition-all hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="truncate">
                      Running · {progress.current}/{progress.total} prompts
                    </span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Run benchmark
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Live trace */}
          {(isRunning || logs.length > 0) && (
            <section
              aria-label="Live evaluation trace"
              className="overflow-hidden rounded-2xl border border-code-border bg-code font-mono text-xs text-code-foreground shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-code-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-code-muted" />
                  <span className="font-semibold tracking-tight">Live trace</span>
                  {isRunning && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-code-muted">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                      streaming
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-code-muted">
                  <span className={LOG_TONE.pass}>{tally.passed} pass</span>
                  <span className={LOG_TONE.fail}>{tally.incorrect} fail</span>
                  <span className={tally.errored > 0 ? LOG_TONE.error : undefined}>
                    {tally.errored} error{tally.errored === 1 ? "" : "s"}
                  </span>
                  <span className="font-semibold text-code-foreground">
                    {progress.current}/{progress.total}
                  </span>
                </div>
              </div>

              <div
                className="h-1 w-full bg-code-border"
                role="progressbar"
                aria-label="Run progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentComplete}
              >
                <div
                  className="h-full bg-brand transition-all duration-300 ease-out"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>

              <div
                ref={logContainerRef}
                role="log"
                className="max-h-72 space-y-1.5 overflow-y-auto p-4 leading-relaxed"
              >
                {logs.map((l) => (
                  <div key={l.id} className="flex items-start gap-3">
                    <span className="shrink-0 select-none text-[10px] tabular-nums text-code-muted/70">
                      {l.time}
                    </span>
                    <span className={cn("min-w-0 [overflow-wrap:anywhere]", LOG_TONE[l.type])}>
                      {l.text}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Side column */}
        <div className="min-w-0 space-y-6">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
            <h2 className="border-b border-border pb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Run specification
            </h2>
            <dl className="space-y-3 text-xs">
              <SpecRow label="Model">
                <span className="font-semibold text-foreground">
                  {selectedModel ? formatModelName(selectedModel.name) : "—"}
                </span>
              </SpecRow>
              <SpecRow label="Provider">
                {selectedModel ? formatVendor(selectedModel.vendor) : "—"}
              </SpecRow>
              <SpecRow label="API route">
                <span className="font-mono text-muted-foreground">
                  {selectedModel?.api_identifier ?? "—"}
                </span>
              </SpecRow>
              <SpecRow label="Pricing">
                <span className="text-success">{selectedModel ? "Free tier" : "—"}</span>
              </SpecRow>
              <SpecRow label="Suite">{selectedBenchmark?.name ?? "—"}</SpecRow>
              <SpecRow label="Scorer">
                <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
                  {selectedBenchmark?.scoring_method ?? "—"}
                </span>
              </SpecRow>
              <SpecRow label="Prompts">
                <span className="font-mono tabular-nums">
                  {effectiveCount} of {available} available
                </span>
              </SpecRow>
            </dl>
          </section>

          {runResult && (
            <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs animate-in fade-in duration-300">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  {runResult.status === "failed" ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      Run failed
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      Run complete
                    </>
                  )}
                </h2>
                <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[11px] tabular-nums text-foreground">
                  {runResult.questionsCorrect}/{runResult.questionsEvaluated} correct
                </span>
              </div>

              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Measured accuracy</p>
                {runResult.status === "failed" ? (
                  // Zero successful calls: a 0% with a CI would read as signal. Show why instead.
                  <p className="text-sm text-muted-foreground">
                    No accuracy recorded. None of the {runResult.questionsEvaluated} model API{" "}
                    {runResult.questionsEvaluated === 1 ? "call" : "calls"} returned a usable
                    response.
                  </p>
                ) : (
                  <AccuracyWithCI
                    variant="stacked"
                    size="xl"
                    accuracy={runResult.accuracy}
                    lower={runResult.ciLower}
                    upper={runResult.ciUpper}
                  />
                )}
              </div>

              <dl className="space-y-2.5 text-xs">
                <SpecRow label="Failed / unscored">
                  <span
                    className={cn(
                      "font-mono tabular-nums",
                      runResult.failedCount > 0 ? "text-destructive" : "text-foreground"
                    )}
                  >
                    {runResult.failedCount}/{runResult.questionsEvaluated} ·{" "}
                    {formatPct(runResult.failureRate)}
                  </span>
                </SpecRow>
                <SpecRow label="Avg latency">
                  <span className="font-mono tabular-nums">
                    {formatLatency(runResult.avgLatencyMs)}
                  </span>
                </SpecRow>
                <SpecRow label="p95 latency">
                  <span className="font-mono tabular-nums">
                    {formatLatency(runResult.p95LatencyMs)}
                  </span>
                </SpecRow>
                <SpecRow label="Throughput">
                  <span className="font-mono tabular-nums">
                    {formatNumber(runResult.tokensPerSecond, 1)} tok/s
                  </span>
                </SpecRow>
                <SpecRow label="Tokens">
                  <span className="font-mono tabular-nums">
                    {formatTokens(runResult.totalTokens)}
                  </span>
                </SpecRow>
                <SpecRow label="Cost">
                  <span className="font-mono tabular-nums">{formatCost(runResult.totalCost)}</span>
                </SpecRow>
              </dl>

              {runResult.truncated && (
                <p className="rounded-lg border border-warning/20 bg-warning/10 p-2.5 text-xs text-warning">
                  Stopped at the run time limit after {runResult.questionsEvaluated} of{" "}
                  {runResult.questionsRequested} prompts. Accuracy and its interval cover only the
                  prompts that ran.
                </p>
              )}

              {runResult.status === "completed" && runResult.failedCount > 0 && (
                <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {runResult.failedCount}{" "}
                  {runResult.failedCount === 1 ? "prompt" : "prompts"} failed or could not be scored.{" "}
                  {runResult.failedCount === 1 ? "It is" : "They are"} excluded from accuracy and its
                  interval, counted in the failure rate, and recorded per prompt.
                </p>
              )}

              {runResult.evaluationId && (
                <Link
                  href={`/dashboard/evaluations/${runResult.evaluationId}`}
                  className={cn(buttonVariants({ size: "lg" }), "h-10 w-full rounded-xl")}
                >
                  View prompt-level results
                  <ArrowRight data-icon="inline-end" />
                </Link>
              )}
            </section>
          )}
        </div>
      </div>

      {isCustomModalMounted && (
        <CustomBenchmarkModal
          isOpen={isCustomModalOpen}
          onClose={() => setIsCustomModalOpen(false)}
          onCreated={handleCustomBenchmarkCreated}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

function BenchmarkOption({ benchmark: b }: { benchmark: EvaluateBenchmark }) {
  const n = b.available_questions;
  return (
    <option value={b.id} disabled={n === 0}>
      {b.name} · {b.scoring_method} · {n > 0 ? `${n} ${n === 1 ? "prompt" : "prompts"}` : "not yet runnable"}
    </option>
  );
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}
