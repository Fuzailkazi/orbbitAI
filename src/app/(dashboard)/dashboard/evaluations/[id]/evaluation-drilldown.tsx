"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Search, HelpCircle, ArrowRight } from "lucide-react";

interface EvaluationResultItem {
  id: string;
  is_correct: boolean;
  score: number;
  latency_ms: number;
  tokens_used: number;
  model_response: string;
  judge_reasoning?: string | null;
  benchmark_questions: {
    prompt: string;
    expected_answer: string;
    metadata?: any;
  } | null;
}

export function EvaluationDrilldown({
  results,
}: {
  results: EvaluationResultItem[];
}) {
  const [filter, setFilter] = useState<"all" | "correct" | "incorrect">("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(results[0]?.id ?? null);

  const filtered = results.filter((r) => {
    if (filter === "correct" && !r.is_correct) return false;
    if (filter === "incorrect" && r.is_correct) return false;
    if (search.trim()) {
      const qText = r.benchmark_questions?.prompt?.toLowerCase() ?? "";
      const rText = r.model_response?.toLowerCase() ?? "";
      const searchLower = search.toLowerCase();
      return qText.includes(searchLower) || rText.includes(searchLower);
    }
    return true;
  });

  const correctCount = results.filter((r) => r.is_correct).length;
  const incorrectCount = results.length - correctCount;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Prompts ({results.length})
          </button>
          <button
            onClick={() => setFilter("correct")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "correct"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Correct ({correctCount})
          </button>
          <button
            onClick={() => setFilter("incorrect")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "incorrect"
                ? "bg-rose-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Incorrect ({incorrectCount})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search prompt or answer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <Card className="border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
            No prompts found matching your filter criteria.
          </Card>
        ) : (
          filtered.map((item, idx) => {
            const isExpanded = expandedId === item.id;
            const q = item.benchmark_questions;

            return (
              <Card
                key={item.id}
                className={`border transition-all shadow-sm ${
                  item.is_correct
                    ? "border-slate-200 hover:border-emerald-300"
                    : "border-rose-200 bg-rose-50/20 hover:border-rose-300"
                }`}
              >
                <CardHeader
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="cursor-pointer p-4 transition-colors hover:bg-slate-50/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono text-[11px] font-semibold text-slate-600">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="line-clamp-2 text-sm font-medium text-slate-900">
                          {q?.prompt ?? "Question content unavailable"}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                          <span>Latency: {item.latency_ms}ms</span>
                          <span>•</span>
                          <span>Tokens: {item.tokens_used}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {item.is_correct ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" /> Correct
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[11px] font-medium text-rose-700">
                          <XCircle className="mr-1 h-3 w-3 text-rose-600" /> Incorrect
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="border-t border-slate-100 bg-slate-50/40 p-4 space-y-4">
                    <div>
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Full Prompt
                      </h4>
                      <pre className="mt-1.5 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800">
                        {q?.prompt}
                      </pre>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Model Response
                        </h4>
                        <pre className={`mt-1.5 whitespace-pre-wrap rounded-lg border p-3 font-mono text-xs ${
                          item.is_correct
                            ? "border-emerald-200 bg-emerald-50/40 text-emerald-950"
                            : "border-rose-200 bg-rose-50/50 text-rose-950"
                        }`}>
                          {item.model_response}
                        </pre>
                      </div>

                      <div>
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Ground Truth (Expected)
                        </h4>
                        <pre className="mt-1.5 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800">
                          {q?.expected_answer}
                        </pre>
                      </div>
                    </div>

                    {item.judge_reasoning && (
                      <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900">
                          <HelpCircle className="h-3.5 w-3.5 text-indigo-600" />
                          Evaluation Analysis
                        </div>
                        <p className="mt-1 text-xs text-indigo-950/80">
                          {item.judge_reasoning}
                        </p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
