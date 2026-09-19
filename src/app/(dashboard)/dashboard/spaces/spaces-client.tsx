"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calculator, Code, Brain, MessageCircle, CheckCircle, Bot,
  ArrowRight, BarChart3, Plus, Trash2, X, Loader2
} from "lucide-react";
import type { Space, Benchmark } from "@/types/database";

const spaceIcons: Record<string, typeof Calculator> = {
  calculator: Calculator, code: Code, brain: Brain,
  "message-circle": MessageCircle, "check-circle": CheckCircle, bot: Bot,
  "layout-grid": BarChart3,
};

const iconOptions = [
  { label: "Brain / Reasoning", value: "brain" },
  { label: "Code / Developer", value: "code" },
  { label: "Calculator / Math", value: "calculator" },
  { label: "Message / Chat", value: "message-circle" },
  { label: "Check / Factuality", value: "check-circle" },
  { label: "Bot / Agentic", value: "bot" },
];

export function SpacesClient({
  spaces,
  benchmarks,
  spaceStats,
}: {
  spaces: Space[];
  benchmarks: Benchmark[];
  spaceStats: Array<{
    space: Space;
    names: string[];
    count: number;
    avg: number | null;
    top: any;
  }>;
}) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("brain");
  const [selectedBenchmarkIds, setSelectedBenchmarkIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleBenchmark(bId: string) {
    setSelectedBenchmarkIds((prev) =>
      prev.includes(bId) ? prev.filter((id) => id !== bId) : [...prev, bId]
    );
  }

  async function handleCreateSpace(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (selectedBenchmarkIds.length === 0) {
      setError("Please select at least one benchmark.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          icon,
          benchmarkIds: selectedBenchmarkIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create space.");
      }

      setIsModalOpen(false);
      setName("");
      setDescription("");
      setSelectedBenchmarkIds([]);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create space.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSpace(id: string) {
    if (!confirm("Are you sure you want to delete this custom space?")) return;
    setDeletingId(id);

    try {
      const res = await fetch(`/api/spaces?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to delete space.");
      } else {
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || "Network error.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Evaluation Spaces</h1>
          <p className="mt-1 text-sm text-slate-500">
            Domain-focused benchmark clusters. Group multiple benchmarks to measure aggregate performance.
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 w-fit"
        >
          <Plus className="h-4 w-4" /> Create Space
        </button>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg border-slate-200 bg-white shadow-xl max-h-[90vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
              <CardTitle className="text-base font-semibold text-slate-900">
                Create New Evaluation Space
              </CardTitle>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>

            <form onSubmit={handleCreateSpace} className="flex flex-col flex-1 overflow-hidden">
              <CardContent className="p-5 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Space Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Financial Analyst AI or SQL Assistants"
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Briefly describe what capabilities this space measures..."
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Icon Theme
                  </label>
                  <select
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none"
                  >
                    {iconOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Include Benchmarks ({selectedBenchmarkIds.length} selected)
                    </label>
                    <span className="text-[11px] text-slate-400">Select 1 or more</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                    {benchmarks.map((b) => {
                      const isSelected = selectedBenchmarkIds.includes(b.id);
                      return (
                        <button
                          type="button"
                          key={b.id}
                          onClick={() => toggleBenchmark(b.id)}
                          className={`flex items-center gap-2 rounded-md p-2 text-left text-xs transition-colors ${
                            isSelected
                              ? "bg-indigo-600 text-white font-medium shadow-xs"
                              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span className="truncate">{b.name}</span>
                          <span className={`text-[10px] ml-auto uppercase ${isSelected ? "text-indigo-200" : "text-slate-400"}`}>
                            {b.category}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <p className="rounded-md bg-rose-50 p-2 text-xs font-medium text-rose-700">
                    {error}
                  </p>
                )}
              </CardContent>

              <div className="border-t border-slate-100 p-4 flex justify-end gap-2 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Create Space
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Grid of Spaces */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {spaceStats.map(({ space, names, count, avg, top }) => {
          const Icon = spaceIcons[space.icon] ?? BarChart3;
          const isDeleting = deletingId === space.id;

          return (
            <Card key={space.id} className="border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-500">
                      {names.length} benchmarks
                    </Badge>
                    <button
                      onClick={() => handleDeleteSpace(space.id)}
                      disabled={isDeleting}
                      title="Delete space"
                      className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <CardTitle className="mt-3 text-base font-semibold text-slate-900">{space.name}</CardTitle>
                <p className="text-xs text-slate-500 line-clamp-2">{space.description || "Custom evaluation space"}</p>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="flex flex-wrap gap-1 max-h-16 overflow-hidden">
                  {names.map((n) => (
                    <span key={n} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {n}
                    </span>
                  ))}
                </div>

                {count > 0 ? (
                  <div className="rounded-lg bg-slate-50 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Avg Accuracy</span>
                      <span className="font-mono font-semibold text-slate-900">{avg?.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Evaluations</span>
                      <span className="font-mono text-slate-700">{count}</span>
                    </div>
                    {top && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Top Model</span>
                        <span className="font-medium text-indigo-600 truncate max-w-[140px]">
                          {(top.models as unknown as { name: string })?.name}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg bg-slate-50/60 p-3 text-center text-xs text-slate-400">
                    No completed evaluations yet for these benchmarks.
                  </div>
                )}

                <Link
                  href="/dashboard/leaderboard"
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 pt-1"
                >
                  View in Leaderboard <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
