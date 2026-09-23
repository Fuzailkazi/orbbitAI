"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, MessageSquareText, Search, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatLatency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One prompt-level trace, pre-shaped on the server (see ./trace-format.ts) so the payload holds
 * only what is rendered or searched.
 */
export interface EvaluationResultItem {
  id: string;
  is_correct: boolean;
  score: number | null;
  latency_ms: number | null;
  tokens_used: number | null;
  time_to_first_token_ms: number | null;
  model_response: string | null;
  judge_reasoning: string | null;
  /** What the response was graded against (expected answer, tests or baseline response). */
  reference: { label: string; body: string };
  /** Null when the question row is missing. */
  question: {
    prompt: string;
    /** Metadata display chips as [label, value]. */
    chips: Array<[string, string]>;
    /** Searchable expected answer; omitted when identical to `reference.body`. */
    expected_answer?: string | null;
  } | null;
}

type ResultFilter = "all" | "correct" | "incorrect" | "excluded";

/** The runner records API failures (rule 9) with this rationale prefix. */
const FAILURE_PREFIX = "Model API call failed";
/** The runner prefixes prompts the scorer could not grade (judge down, sandbox failed…). */
const UNSCORED_PREFIX = "[Unscored]";

function isApiFailure(item: EvaluationResultItem) {
  return !item.is_correct && (item.judge_reasoning?.startsWith(FAILURE_PREFIX) ?? false);
}

function isUnscored(item: EvaluationResultItem) {
  return !item.is_correct && (item.judge_reasoning?.startsWith(UNSCORED_PREFIX) ?? false);
}

/** Failed calls and unscored prompts are excluded from accuracy and counted in the failure rate. */
function isExcluded(item: EvaluationResultItem) {
  return isApiFailure(item) || isUnscored(item);
}

/** Traces rendered up front; the rest load in steps so 200-prompt runs stay light. */
const PAGE_STEP = 50;

export function EvaluationDrilldown({
  results,
  questionsEvaluated,
}: {
  results: EvaluationResultItem[];
  /** Total questions scored in the run; traces may be a sample of these. */
  questionsEvaluated: number;
}) {
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(results[0]?.id ?? null);
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);

  const correctCount = results.filter((r) => r.is_correct).length;
  const excludedCount = results.filter(isExcluded).length;
  const incorrectCount = results.length - correctCount - excludedCount;
  const query = search.trim().toLowerCase();

  // Keep each prompt's original position so numbering is stable across filters.
  const indexed = results.map((r, i) => ({ item: r, number: i + 1 }));
  const filtered = indexed.filter(({ item }) => {
    if (filter === "correct" && !item.is_correct) return false;
    if (filter === "incorrect" && (item.is_correct || isExcluded(item))) return false;
    if (filter === "excluded" && !isExcluded(item)) return false;
    if (!query) return true;
    const q = item.question;
    const haystack = [
      q?.prompt,
      q ? (q.expected_answer === undefined ? item.reference.body : q.expected_answer) : null,
      item.model_response,
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();
    return haystack.includes(query);
  });

  const tabs: Array<{ value: ResultFilter; label: string; count: number; dot?: string }> = [
    { value: "all", label: "All prompts", count: results.length },
    { value: "correct", label: "Correct", count: correctCount, dot: "bg-success" },
    { value: "incorrect", label: "Incorrect", count: incorrectCount, dot: "bg-destructive" },
    ...(excludedCount > 0
      ? [{ value: "excluded" as const, label: "Failed / unscored", count: excludedCount, dot: "bg-warning" }]
      : []),
  ];

  const isSample = questionsEvaluated > results.length;
  const visible = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visible.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label="Filter prompts by outcome"
          className="flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1 shadow-sm [scrollbar-width:none] sm:w-auto"
        >
          {tabs.map((tab) => {
            const active = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setFilter(tab.value);
                  setVisibleCount(PAGE_STEP);
                }}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                )}
              >
                {tab.dot && <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", tab.dot)} />}
                {tab.label}
                <span className="font-mono tabular-nums opacity-70">{tab.count}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search prompts, answers and responses"
            placeholder="Search prompt or answer…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(PAGE_STEP);
            }}
            className="h-9 rounded-xl bg-card pl-9 shadow-sm"
          />
        </div>
      </div>

      {isSample && (
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-mono tabular-nums text-foreground">{formatNumber(results.length)}</span>{" "}
          traced prompts from{" "}
          <span className="font-mono tabular-nums text-foreground">{formatNumber(questionsEvaluated)}</span>{" "}
          evaluated questions.
        </p>
      )}

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
            No prompts match your filter.
          </div>
        ) : (
          visible.map(({ item, number }) => {
            const isExpanded = expandedId === item.id;
            const q = item.question;
            const meta = q?.chips ?? [];
            const panelId = `trace-${item.id}`;
            const failed = isApiFailure(item);
            const unscored = isUnscored(item);
            const reference = item.reference;

            return (
              <div
                key={item.id}
                className={cn(
                  "overflow-hidden rounded-xl border bg-card shadow-sm transition-colors",
                  item.is_correct
                    ? "border-border hover:border-success/40"
                    : "border-destructive/25 hover:border-destructive/40"
                )}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium text-foreground", isExpanded ? "whitespace-pre-wrap break-words" : "line-clamp-2")}>
                      {q?.prompt ?? "Question content unavailable"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                      <span>{formatLatency(item.latency_ms)}</span>
                      {item.time_to_first_token_ms !== null && (
                        <span>TTFT {formatLatency(item.time_to_first_token_ms)}</span>
                      )}
                      <span>{formatNumber(item.tokens_used)} tok</span>
                      {item.score !== null && <span>score {item.score.toFixed(2)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.is_correct ? (
                      <span className="inline-flex h-5 items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 text-[11px] font-medium text-success">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="hidden min-[420px]:inline">Correct</span>
                      </span>
                    ) : failed ? (
                      <span
                        className="inline-flex h-5 items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2 text-[11px] font-medium text-warning"
                        title="The model API call failed (recorded, never retried). Excluded from accuracy; counted in the failure rate."
                      >
                        <AlertTriangle className="h-3 w-3" />
                        <span className="hidden min-[420px]:inline">Request failed</span>
                      </span>
                    ) : unscored ? (
                      <span
                        className="inline-flex h-5 items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2 text-[11px] font-medium text-warning"
                        title="The scorer could not grade this response. Excluded from accuracy; counted in the failure rate."
                      >
                        <AlertTriangle className="h-3 w-3" />
                        <span className="hidden min-[420px]:inline">Not scored</span>
                      </span>
                    ) : (
                      <span className="inline-flex h-5 items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2 text-[11px] font-medium text-destructive">
                        <XCircle className="h-3 w-3" />
                        <span className="hidden min-[420px]:inline">Incorrect</span>
                      </span>
                    )}
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div id={panelId} className="space-y-4 border-t border-border bg-muted/30 p-4">
                    {meta.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {meta.map(([k, v]) => (
                          <span
                            key={k}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground"
                          >
                            <span className="capitalize">{k}</span>
                            <span className="font-mono text-foreground">{v}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="min-w-0">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Model response
                        </h4>
                        <pre
                          className={cn(
                            "mt-1.5 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-xs text-foreground",
                            item.is_correct
                              ? "border-success/20 bg-success/5"
                              : "border-destructive/20 bg-destructive/5"
                          )}
                        >
                          {item.model_response || "(empty response)"}
                        </pre>
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {reference.label}
                        </h4>
                        <pre className="mt-1.5 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-3 font-mono text-xs text-foreground">
                          {reference.body}
                        </pre>
                      </div>
                    </div>

                    {item.judge_reasoning && (
                      <div className="rounded-lg border border-brand/15 bg-brand/5 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <MessageSquareText className="h-3.5 w-3.5 text-brand" />
                          {failed ? "Failure details" : unscored ? "Why it was not scored" : "Scoring rationale"}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {item.judge_reasoning}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setVisibleCount((n) => n + PAGE_STEP)}
            className="rounded-xl border border-dashed border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            Show {formatNumber(Math.min(PAGE_STEP, remaining))} more{" "}
            <span className="font-mono tabular-nums opacity-70">
              ({formatNumber(visible.length)} of {formatNumber(filtered.length)})
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
