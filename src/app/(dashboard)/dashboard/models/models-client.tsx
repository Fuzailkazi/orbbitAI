"use client";

import { useState } from "react";
import Link from "next/link";
import type { Model, ModelCategory } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search, ChevronLeft, ChevronRight, ArrowUpDown, Layers, Star, RefreshCw, Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useFavorites } from "@/hooks/useFavorites";

const ITEMS_PER_PAGE = 20;

const categories: { value: ModelCategory | "all" | "frontier"; label: string }[] = [
  { value: "all", label: "All Models" },
  { value: "frontier", label: "★ Frontier Flagships" },
  { value: "chat", label: "Chat" },
  { value: "reasoning", label: "Reasoning" },
  { value: "code", label: "Code" },
  { value: "vision", label: "Vision" },
  { value: "moe", label: "MoE" },
  { value: "embedding", label: "Embedding" },
  { value: "transformer", label: "Transformer" },
];

const categoryColors: Record<string, string> = {
  frontier: "bg-orange-50 text-orange-700 border-orange-200",
  chat: "bg-indigo-50 text-indigo-600",
  reasoning: "bg-violet-50 text-violet-600",
  code: "bg-emerald-50 text-emerald-600",
  vision: "bg-amber-50 text-amber-600",
  moe: "bg-pink-50 text-pink-600",
  embedding: "bg-cyan-50 text-cyan-600",
  transformer: "bg-slate-100 text-slate-600",
};

type SortKey = "name" | "vendor" | "pricing_input" | "context_window" | "release_date";

function getUniqueVendors(models: Model[]): string[] {
  const vendors = new Set(models.map((m) => m.vendor));
  return Array.from(vendors).sort();
}

export function isFrontierModel(m: Model): boolean {
  const s = (m.api_identifier + " " + m.name).toLowerCase();
  return (
    s.includes("astra") ||
    s.includes("fable") ||
    s.includes("3.8") ||
    s.includes("v4.1") ||
    s.includes("o1") ||
    s.includes("o3") ||
    s.includes("r1") ||
    s.includes("opus-4") ||
    s.includes("sonnet-4")
  );
}

export function ModelsClient({ models }: { models: Model[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ModelCategory | "all" | "frontier">("all");
  const [vendor, setVendor] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  async function handleSyncModels() {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await fetch("/api/models/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Sync failed");
      }
      setSyncStatus(`Synced ${data.data.totalDiscovered} models (${data.data.newModelsAdded} newly added)`);
      router.refresh();
    } catch (err: any) {
      setSyncStatus(err.message || "Failed to sync models.");
    } finally {
      setIsSyncing(false);
    }
  }

  const vendors = getUniqueVendors(models);

  // Filter
  let filtered = models.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.vendor.toLowerCase().includes(search.toLowerCase()) ||
      m.api_identifier.toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      category === "all"
        ? true
        : category === "frontier"
        ? isFrontierModel(m)
        : m.category === category;
    const matchVendor = vendor === "all" || m.vendor === vendor;
    const matchFavorite = !favoritesOnly || isFavorite(m.id);
    return matchSearch && matchCategory && matchVendor && matchFavorite;
  });

  // Sort
  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") cmp = a.name.localeCompare(b.name);
    else if (sortKey === "vendor") cmp = a.vendor.localeCompare(b.vendor);
    else if (sortKey === "pricing_input") cmp = a.pricing_input - b.pricing_input;
    else if (sortKey === "context_window") cmp = a.context_window - b.context_window;
    else if (sortKey === "release_date") cmp = (a.release_date ?? "").localeCompare(b.release_date ?? "");
    return sortAsc ? cmp : -cmp;
  });

  // Paginate
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
    setPage(1);
  }

  function SortHeader({ label, sortField }: { label: string; sortField: SortKey }) {
    const active = sortKey === sortField;
    return (
      <button
        onClick={() => toggleSort(sortField)}
        className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider ${active ? "text-indigo-600" : "text-slate-400"} hover:text-slate-700`}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Models</h1>
          <p className="mt-1 text-sm text-slate-500">
            Browse {models.length} AI models across {vendors.length} vendors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncStatus && (
            <span className="text-xs text-indigo-600 font-medium">{syncStatus}</span>
          )}
          <button
            type="button"
            onClick={handleSyncModels}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {isSyncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            )}
            Sync OpenRouter ({models.length})
          </button>
          <Badge variant="outline" className="border-slate-200 text-slate-500">
            <Layers className="mr-1 h-3 w-3" /> {filtered.length} results
          </Badge>
        </div>
      </div>

      {/* Frontier Flagships Spotlight Shelf */}
      <div className="rounded-2xl border border-black/[0.08] bg-[#FBFBFA] p-5 shadow-2xs space-y-3 font-mono">
        <div className="flex items-center justify-between border-b border-black/[0.05] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orange-600 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-950">
              FRONTIER FLAGSHIPS SPOTLIGHT
            </span>
            <span className="text-[10px] text-zinc-400">•</span>
            <span className="text-[10px] text-zinc-500">Live on OpenRouter API</span>
          </div>
          <button
            type="button"
            onClick={() => { setCategory("frontier"); setSearch(""); setPage(1); }}
            className="text-xs font-bold text-orange-700 hover:underline"
          >
            Filter All Frontier Models ({models.filter(isFrontierModel).length}) →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              name: "OpenAI: GPT-6 Astra",
              id: "openai/gpt-6-astra",
              vendor: "OpenAI",
              spec: "1.05M Ctx • $10/M",
              badge: "FLAGSHIP #1",
              border: "border-zinc-900/30",
              dot: "bg-zinc-950",
            },
            {
              name: "Anthropic: Claude Fable 5.1",
              id: "anthropic/claude-fable-5.1",
              vendor: "Anthropic",
              spec: "1.00M Ctx • $10/M",
              badge: "REASONING SOTA",
              border: "border-orange-300",
              dot: "bg-orange-600",
            },
            {
              name: "DeepSeek: V4.1 Flash",
              id: "deepseek/deepseek-v4.1-flash",
              vendor: "DeepSeek",
              spec: "1.05M Ctx • $0.15/M",
              badge: "SPARSE MOE",
              border: "border-indigo-300",
              dot: "bg-indigo-600",
            },
            {
              name: "Google: Gemini 3.8 Flash",
              id: "google/gemini-3.8-flash",
              vendor: "Google",
              spec: "1.05M Ctx • $0.75/M",
              badge: "220 TPS SPEED",
              border: "border-blue-300",
              dot: "bg-blue-600",
            },
            {
              name: "Qwen: Qwen3.8 Flash",
              id: "qwen/qwen3.8-flash",
              vendor: "Alibaba",
              spec: "1.00M Ctx • $0.15/M",
              badge: "REASONING AGENT",
              border: "border-teal-300",
              dot: "bg-teal-600",
            },
          ].map((f) => {
            const mMatch = models.find((m) => m.api_identifier === f.id);
            return (
              <div
                key={f.id}
                onClick={() => {
                  if (mMatch) {
                    setSearch(f.name.split(":")[1]?.trim() || f.name);
                    setPage(1);
                  }
                }}
                className={`rounded-xl border ${f.border} bg-white p-3 hover:shadow-2xs transition-all cursor-pointer group`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-500">
                    {f.badge}
                  </span>
                  <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />
                </div>
                <p className="text-xs font-bold text-zinc-950 truncate group-hover:text-orange-600 transition-colors">
                  {f.name}
                </p>
                <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400 border-t border-black/[0.04] pt-1.5">
                  <span className="truncate">{f.spec}</span>
                  {mMatch && (
                    <Link
                      href={`/dashboard/models/${mMatch.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-zinc-900 font-bold hover:underline ml-1"
                    >
                      View →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search models, vendors..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-9 border-slate-200 bg-slate-50 pl-9 text-sm placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
              />
            </div>

            {/* Category filter */}
            <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 p-0.5">
              {categories.map((c) => (
                <button
                  key={c.value}
                  onClick={() => { setCategory(c.value); setPage(1); }}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === c.value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Vendor dropdown */}
            <select
              value={vendor}
              onChange={(e) => { setVendor(e.target.value); setPage(1); }}
              className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-600 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
            >
              <option value="all">All Vendors</option>
              {vendors.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="w-10 px-3 py-3 text-center"></th>
                  <th className="px-5 py-3 text-left"><SortHeader label="Model" sortField="name" /></th>
                  <th className="px-5 py-3 text-left"><SortHeader label="Vendor" sortField="vendor" /></th>
                  <th className="px-5 py-3 text-left">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Category</span>
                  </th>
                  <th className="px-5 py-3 text-right"><SortHeader label="Context" sortField="context_window" /></th>
                  <th className="px-5 py-3 text-right"><SortHeader label="Input $/1M" sortField="pricing_input" /></th>
                  <th className="px-5 py-3 text-right">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Output $/1M</span>
                  </th>
                  <th className="px-5 py-3 text-right"><SortHeader label="Released" sortField="release_date" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((model) => (
                  <tr
                    key={model.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleFavorite(model.id)}
                        title={isFavorite(model.id) ? "Remove from favorites" : "Add to favorites"}
                        className="p-1 text-slate-300 hover:text-amber-500 transition-colors"
                      >
                        <Star className={`h-4 w-4 ${isFavorite(model.id) ? "fill-amber-400 text-amber-500" : ""}`} />
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/models/${model.id}`}
                        className="text-sm font-medium text-slate-800 hover:text-indigo-600 transition-colors"
                      >
                        {model.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400">{model.api_identifier}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{model.vendor}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${categoryColors[model.category] ?? "bg-slate-100 text-slate-600"}`}>
                        {model.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">
                      {model.context_window >= 1000000
                        ? `${(model.context_window / 1000000).toFixed(1)}M`
                        : `${(model.context_window / 1000).toFixed(0)}K`}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">
                      {model.pricing_input === 0 ? "Free" : `$${model.pricing_input}`}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">
                      {model.pricing_output === 0 ? "Free" : `$${model.pricing_output}`}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-slate-400">
                      {model.release_date
                        ? new Date(model.release_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                        : "—"}
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                      No models found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                    page === p
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
