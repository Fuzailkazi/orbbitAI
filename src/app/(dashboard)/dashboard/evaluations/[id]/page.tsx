import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Clock, DollarSign, ShieldCheck, Zap } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { AccuracyWithCI } from "@/components/evaluations/accuracy-with-ci";
import {
  formatCost,
  formatLatency,
  formatModelName,
  formatNumber,
  formatPct,
  formatPricePerMillion,
  formatTokens,
  formatVendor,
  resolveCI,
  scoredQuestionCount,
} from "@/lib/format";
import { getVendorColor } from "@/lib/vendor-colors";
import { STALLED_RUN_MESSAGE, isStalledEvaluation } from "@/lib/eval/stalled";
import { cn } from "@/lib/utils";
import type {
  Benchmark,
  Evaluation,
  EvaluationStatus,
  Model,
  ScoringMethod,
} from "@/types/database";
import { EvaluationDrilldown } from "./evaluation-drilldown";
import { toTraceItem, type TraceRow } from "./trace-format";

export const metadata: Metadata = {
  title: "Evaluation run",
};

type EvaluationDetailRow = Evaluation & {
  models: Pick<
    Model,
    "id" | "name" | "vendor" | "category" | "pricing_input" | "pricing_output"
  > | null;
  benchmarks: Pick<Benchmark, "id" | "name" | "category" | "scoring_method"> | null;
};

const SCORING_LABELS: Record<ScoringMethod, string> = {
  exact_match: "Exact match",
  normalized_match: "Normalized match",
  pass_at_k: "Pass@k",
  llm_judge: "LLM-as-judge",
  bleu: "BLEU",
  rouge: "ROUGE",
};

/** DB status plus the derived "stalled" state (same as the evaluations list). */
type DisplayStatus = EvaluationStatus | "stalled";

const STATUS_STYLES: Record<DisplayStatus, { label: string; className: string; dot: string }> = {
  completed: { label: "Completed run", className: "border-success/20 bg-success/10 text-success", dot: "bg-success" },
  running: { label: "Running", className: "border-brand/20 bg-brand/10 text-brand", dot: "bg-brand animate-pulse" },
  pending: { label: "Queued", className: "border-warning/20 bg-warning/10 text-warning", dot: "bg-warning" },
  failed: { label: "Failed", className: "border-destructive/20 bg-destructive/10 text-destructive", dot: "bg-destructive" },
  cancelled: { label: "Cancelled", className: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  stalled: { label: "Stalled", className: "border-warning/20 bg-warning/10 text-warning", dot: "bg-warning" },
};

interface CostSummary {
  value: string;
  note: string;
  title?: string;
}

/**
 * Rule 7: costs are calculated from tokens × the model's known pricing.
 * Prefers the recorded `total_cost`; when it is missing/zero but tokens and paid pricing
 * exist, computes it. Only `total_tokens` is stored (no input/output split), so when input
 * and output prices differ the result is the exact range between all-input and all-output.
 */
function summarizeCost(ev: EvaluationDetailRow): CostSummary {
  const tokens = ev.total_tokens ?? 0;
  const tokenLabel = `${formatTokens(tokens)} tokens`;

  if (ev.total_cost !== null && ev.total_cost > 0) {
    return { value: formatCost(ev.total_cost), note: `Recorded · ${tokenLabel}` };
  }

  const model = ev.models;
  if (!model) {
    return { value: formatCost(ev.total_cost), note: tokens > 0 ? tokenLabel : "No usage recorded" };
  }

  const pin = Number(model.pricing_input ?? 0);
  const pout = Number(model.pricing_output ?? 0);

  if (pin === 0 && pout === 0) {
    return { value: "$0", note: tokens > 0 ? `Free model · ${tokenLabel}` : "Free model" };
  }
  if (tokens <= 0) {
    return { value: "—", note: "No token usage recorded" };
  }

  const lowRate = Math.min(pin, pout);
  const highRate = Math.max(pin, pout);
  const low = (tokens * lowRate) / 1_000_000;
  const high = (tokens * highRate) / 1_000_000;

  if (lowRate === highRate) {
    return {
      value: formatCost(low),
      note: `Calculated · ${tokenLabel} × ${formatPricePerMillion(lowRate)}`,
    };
  }
  return {
    value: `${formatCost(low)}–${formatCost(high)}`,
    note: `Calculated · ${tokenLabel} × ${formatPricePerMillion(lowRate)}–${formatPricePerMillion(highRate)}`,
    title: `Input/output split was not recorded for this run, so the cost is shown as the exact range between all tokens billed at the input rate (${formatPricePerMillion(pin)}) and at the output rate (${formatPricePerMillion(pout)}).`,
  };
}

function MetricCard({
  label,
  icon: Icon,
  children,
  footer,
  title,
  wide = false,
}: {
  label: string;
  icon: typeof Clock;
  children: ReactNode;
  footer: ReactNode;
  title?: string;
  /** Spans both columns on phones (for wider values like a CI or a cost range). */
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5",
        wide && "col-span-2 sm:col-span-1"
      )}
      title={title}
    >
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 min-w-0">{children}</div>
      <p className="mt-1.5 break-words font-mono text-[11px] leading-snug tabular-nums text-muted-foreground">
        {footer}
      </p>
    </div>
  );
}

export default async function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const [evalRes, resultsRes] = await Promise.all([
    supabase
      .from("evaluations")
      .select(
        "*, models(id, name, vendor, category, pricing_input, pricing_output), benchmarks(id, name, category, scoring_method)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("evaluation_results")
      .select(
        "id, is_correct, score, latency_ms, tokens_used, time_to_first_token_ms, model_response, judge_reasoning, created_at, benchmark_questions(prompt, expected_answer, metadata)"
      )
      .eq("evaluation_id", id)
      .order("created_at", { ascending: true }),
  ]);

  // Invalid UUIDs surface as a Postgres error (22P02); treat those as not found too.
  if (evalRes.error && evalRes.error.code !== "22P02") {
    throw new Error(`Failed to load evaluation: ${evalRes.error.message}`);
  }
  if (!evalRes.data) {
    notFound();
  }
  if (resultsRes.error) {
    throw new Error(`Failed to load prompt results: ${resultsRes.error.message}`);
  }

  const evaluation = evalRes.data as EvaluationDetailRow;
  // Always fresh (invariant 6): prompt-level results are read per request, never cached.
  const resultRows = (resultsRes.data ?? []) as unknown as TraceRow[];
  const promptResults = resultRows.map(toTraceItem);
  const model = evaluation.models;
  const benchmark = evaluation.benchmarks;
  const modelName = formatModelName(model?.name ?? "Unknown model");
  // Display-only: a stuck `running` row (or one the reaper already closed) reads as Stalled.
  // A batch run has no deadline, so recent per-prompt activity keeps it live.
  const lastActivityMs = resultRows.reduce<number | null>((latest, r) => {
    const t = typeof r.created_at === "string" ? Date.parse(r.created_at) : Number.NaN;
    return Number.isFinite(t) && (latest === null || t > latest) ? t : latest;
  }, null);
  const isStalled = isStalledEvaluation(evaluation, undefined, lastActivityMs);
  const status = isStalled ? STATUS_STYLES.stalled : (STATUS_STYLES[evaluation.status] ?? STATUS_STYLES.cancelled);
  const ci = resolveCI(evaluation);
  const cost = summarizeCost(evaluation);
  const isCompleted = evaluation.status === "completed";
  const completedOn = evaluation.completed_at
    ? new Date(evaluation.completed_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        // Deterministic regardless of the server's local zone.
        timeZone: "UTC",
      })
    : null;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-16">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/dashboard/evaluations"
          className="inline-flex shrink-0 items-center gap-1 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Evaluations
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate font-medium text-foreground">
          {modelName} on {benchmark?.name ?? "Unknown benchmark"}
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {model ? (
                <Link href={`/dashboard/models/${model.id}`} className="transition-colors hover:text-brand">
                  {modelName}
                </Link>
              ) : (
                modelName
              )}
            </h1>
            <span className="inline-flex h-5 items-center gap-1.5 rounded-full border border-border px-2 text-xs font-medium text-foreground">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: getVendorColor(model?.vendor) }}
              />
              {formatVendor(model?.vendor)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{benchmark?.name ?? "Unknown benchmark"}</span>
            {benchmark?.category && <span className="capitalize"> · {benchmark.category}</span>}
            {benchmark?.scoring_method && (
              <> · scored by {SCORING_LABELS[benchmark.scoring_method] ?? benchmark.scoring_method}</>
            )}
            {completedOn && <> · {completedOn}</>}
          </p>
        </div>

        <span
          title={isStalled ? STALLED_RUN_MESSAGE : undefined}
          className={cn(
            "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium",
            status.className
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          {status.label}
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard
          label="Accuracy"
          icon={ShieldCheck}
          wide
          footer={
            evaluation.questions_evaluated > 0
              ? `${formatNumber(evaluation.questions_correct)}/${formatNumber(scoredQuestionCount(evaluation))} scored prompts correct · ${formatNumber(evaluation.questions_evaluated)} attempted${
                  evaluation.failure_rate !== null ? ` · ${formatPct(evaluation.failure_rate)} failed or unscored` : ""
                }`
              : "No questions evaluated"
          }
        >
          {isCompleted ? (
            <AccuracyWithCI
              accuracy={ci.accuracy}
              lower={ci.lower}
              upper={ci.upper}
              variant="stacked"
              size="lg"
            />
          ) : (
            <p className="font-mono text-2xl font-semibold tabular-nums text-muted-foreground">—</p>
          )}
        </MetricCard>

        <MetricCard
          label="Avg latency"
          icon={Clock}
          footer={`Median ${formatLatency(evaluation.median_latency_ms)} · P95 ${formatLatency(evaluation.p95_latency_ms)}`}
        >
          <p className="font-mono text-2xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {formatLatency(evaluation.avg_latency_ms)}
          </p>
        </MetricCard>

        <MetricCard label="Throughput" icon={Zap} footer="output tokens / second">
          <p className="font-mono text-2xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {formatNumber(evaluation.tokens_per_second, evaluation.tokens_per_second !== null && evaluation.tokens_per_second > 0 && evaluation.tokens_per_second < 10 ? 1 : 0)}
          </p>
        </MetricCard>

        <MetricCard label="Cost" icon={DollarSign} footer={cost.note} title={cost.title} wide>
          <p className="break-words font-mono text-2xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {cost.value}
          </p>
        </MetricCard>
      </div>

      {/* Prompt drilldown (rule 2) */}
      <section className="space-y-3 pt-2" aria-labelledby="traces-heading">
        <div>
          <h2 id="traces-heading" className="text-lg font-semibold text-foreground">
            Prompt-level traces
          </h2>
          <p className="text-sm text-muted-foreground">
            Every prompt, the model&apos;s answer, the expected solution and the scoring decision.
          </p>
        </div>

        {promptResults.length > 0 ? (
          <EvaluationDrilldown
            results={promptResults}
            questionsEvaluated={evaluation.questions_evaluated}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">No per-prompt traces available</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {isCompleted
                ? "This evaluation was imported from pre-aggregated benchmark results. Prompt-level traces appear for live evaluation runs."
                : isStalled
                  ? STALLED_RUN_MESSAGE
                  : evaluation.status === "failed" || evaluation.status === "cancelled"
                    ? "This run ended before recording any prompt results."
                    : "Traces will appear here as soon as the run records its first results."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
