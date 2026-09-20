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
  { value: "frontier", label: "★ Frontier flagships" },
  { value: "chat", label: "Chat" },
  { value: "reasoning", label: "Reasoning" },
  { value: "code", label: "Code" },
  { value: "vision", label: "Vision" },
  { value: "moe", label: "MoE" },
  { value: "embedding", label: "Embedding" },
  { value: "transformer", label: "Transformer" },
];

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
        className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider font-sans transition-colors ${active ? "text-blue-600" : "text-muted-foreground"} hover:text-foreground`}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground font-sans">Models</h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed font-sans">
            Browse {models.length} AI models across {vendors.length} vendors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncStatus && (
            <span className="text-xs text-blue-600 font-medium font-sans">{syncStatus}</span>
          )}
          <button
            type="button"
            onClick={handleSyncModels}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted active:scale-[0.98] disabled:opacity-50 transition-all font-sans"
          >
            {isSyncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            Sync OpenRouter ({models.length})
          </button>
          <Badge variant="outline" className="border-border text-muted-foreground font-sans text-xs font-medium px-2.5 py-0.5 rounded-full">
            <Layers className="mr-1 h-3 w-3" /> {filtered.length} results
          </Badge>
        </div>
      </div>

      {/* Frontier Flagships Spotlight Shelf */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-medium text-foreground font-sans">
              Frontier flagships spotlight
            </span>
            <span className="text-[10px] text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground font-sans">Live on OpenRouter API</span>
          </div>
          <button
            type="button"
            onClick={() => { setCategory("frontier"); setSearch(""); setPage(1); }}
            className="text-xs font-medium text-blue-600 hover:underline transition-colors font-sans"
          >
            Filter all frontier models ({models.filter(isFrontierModel).length}) →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              name: "OpenAI: GPT-6 Astra",
              id: "openai/gpt-6-astra",
              vendor: "OpenAI",
              spec: "1.05M Ctx • $10/M",
              badge: "Flagship #1",
            },
            {
              name: "Anthropic: Claude Fable 5.1",
              id: "anthropic/claude-fable-5.1",
              vendor: "Anthropic",
              spec: "1.00M Ctx • $10/M",
              badge: "Reasoning SOTA",
            },
            {
              name: "DeepSeek: V4.1 Flash",
              id: "deepseek/deepseek-v4.1-flash",
              vendor: "DeepSeek",
              spec: "1.05M Ctx • $0.15/M",
              badge: "Sparse MoE",
            },
            {
              name: "Google: Gemini 3.8 Flash",
              id: "google/gemini-3.8-flash",
              vendor: "Google",
              spec: "1.05M Ctx • $0.75/M",
              badge: "220 TPS speed",
            },
            {
              name: "Qwen: Qwen3.8 Flash",
              id: "qwen/qwen3.8-flash",
              vendor: "Alibaba",
              spec: "1.00M Ctx • $0.15/M",
              badge: "Reasoning agent",
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
                className="rounded-xl border border-border bg-card p-4 hover:border-border/80 hover:shadow-sm transition-all cursor-pointer group flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-muted text-foreground">
                    {f.badge}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground truncate group-hover:text-blue-600 transition-colors font-sans mt-1">
                  {f.name}
                </p>
                <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2 font-sans">
                  <span className="truncate font-mono tabular-nums">{f.spec}</span>
                  {mMatch && (
                    <Link
                      href={`/dashboard/models/${mMatch.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-foreground font-medium hover:text-blue-600 transition-colors ml-1 font-sans"
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
      <Card className="border-border bg-card shadow-sm rounded-xl">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search models, vendors..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:border-primary font-sans transition-colors"
              />
            </div>

            {/* Category filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {categories.map((c) => {
                const isActive = category === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => { setCategory(c.value); setPage(1); }}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all active:scale-[0.98] font-sans ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* Vendor dropdown */}
            <select
              value={vendor}
              onChange={(e) => { setVendor(e.target.value); setPage(1); }}
              className="h-9 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary font-sans transition-colors"
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
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead className="bg-muted/40">
              <tr className="border-b border-border">
                <th className="w-10 px-4 py-3 text-center"></th>
                <th className="px-5 py-3 text-left"><SortHeader label="Model" sortField="name" /></th>
                <th className="px-5 py-3 text-left"><SortHeader label="Vendor" sortField="vendor" /></th>
                <th className="px-5 py-3 text-left">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-sans">Category</span>
                </th>
                <th className="px-5 py-3 text-right"><SortHeader label="Context" sortField="context_window" /></th>
                <th className="px-5 py-3 text-right"><SortHeader label="Input $/1M" sortField="pricing_input" /></th>
                <th className="px-5 py-3 text-right">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground font-sans">Output $/1M</span>
                </th>
                <th className="px-5 py-3 text-right"><SortHeader label="Released" sortField="release_date" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {paginated.map((model) => (
                <tr
                  key={model.id}
                  className="transition-colors hover:bg-muted/50"
                >
                  <td className="px-4 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => toggleFavorite(model.id)}
                      title={isFavorite(model.id) ? "Remove from favorites" : "Add to favorites"}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors active:scale-[0.98]"
                    >
                      <Star className={`h-4 w-4 ${isFavorite(model.id) ? "fill-primary text-primary" : ""}`} />
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/dashboard/models/${model.id}`}
                      className="text-sm font-medium text-foreground hover:text-blue-600 transition-colors font-sans"
                    >
                      {model.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground font-sans">{model.api_identifier}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-muted-foreground font-sans">{model.vendor}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground font-sans">
                      {model.category}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-mono tabular-nums text-sm text-muted-foreground">
                    {model.context_window >= 1000000
                      ? `${(model.context_window / 1000000).toFixed(1)}M`
                      : `${(model.context_window / 1000).toFixed(0)}K`}
                  </td>
                  <td className="px-5 py-4 text-right font-mono tabular-nums text-sm text-muted-foreground">
                    {model.pricing_input === 0 ? "Free" : `$${model.pricing_input}`}
                  </td>
                  <td className="px-5 py-4 text-right font-mono tabular-nums text-sm text-muted-foreground">
                    {model.pricing_output === 0 ? "Free" : `$${model.pricing_output}`}
                  </td>
                  <td className="px-5 py-4 text-right text-sm text-muted-foreground font-mono tabular-nums">
                    {model.release_date
                      ? new Date(model.release_date).toLocaleDateString("en-US", { month: "short", year: "numeric", day: "numeric" })
                      : "—"}
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground font-sans">
                    No models found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground font-sans">
            Showing <span className="font-mono tabular-nums">{(page - 1) * ITEMS_PER_PAGE + 1}</span>–<span className="font-mono tabular-nums">{Math.min(page * ITEMS_PER_PAGE, filtered.length)}</span> of <span className="font-mono tabular-nums">{filtered.length}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground transition-all hover:bg-muted active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-all active:scale-[0.98] font-mono tabular-nums ${
                    page === p
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground transition-all hover:bg-muted active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
