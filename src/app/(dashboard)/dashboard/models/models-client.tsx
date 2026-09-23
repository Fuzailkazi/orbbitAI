"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react";
import type { ModelCategory } from "@/types/database";
import type { CatalogModel } from "@/lib/data";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useFavorites } from "@/hooks/useFavorites";
import {
  formatContext,
  formatCost,
  formatModelName,
  formatPricePerMillion,
  formatVendor,
} from "@/lib/format";
import { getVendorColor } from "@/lib/vendor-colors";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 20;

type CategoryFilter = ModelCategory | "all" | "frontier";
type SortKey = "name" | "vendor" | "pricing_input" | "context_window" | "release_date";

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
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

const SORT_KEYS: readonly SortKey[] = ["name", "vendor", "pricing_input", "context_window", "release_date"];

/** Hand-picked spotlight. Live pricing/context come from the catalog row when it exists. */
const FRONTIER_SPOTLIGHT: {
  id: string;
  name: string;
  vendor: string;
  badge: string;
  context: number;
  price: number;
}[] = [
  { id: "openai/gpt-6-astra", name: "GPT-6 Astra", vendor: "openai", badge: "Flagship #1", context: 1_050_000, price: 10 },
  { id: "anthropic/claude-fable-5.1", name: "Claude Fable 5.1", vendor: "anthropic", badge: "Reasoning SOTA", context: 1_000_000, price: 10 },
  { id: "deepseek/deepseek-v4.1-flash", name: "V4.1 Flash", vendor: "deepseek", badge: "Sparse MoE", context: 1_050_000, price: 0.15 },
  { id: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash", vendor: "google", badge: "Speed leader", context: 1_050_000, price: 0.75 },
  { id: "qwen/qwen3.8-flash", name: "Qwen3.8 Flash", vendor: "qwen", badge: "Reasoning agent", context: 1_000_000, price: 0.15 },
];

const FRONTIER_PATTERN =
  /astra|fable|opus-4|sonnet-4|3\.8|v4\.1|(^|[/-])(o1|o3|r1)([-:.]|$)/;

function isFrontierModel(m: CatalogModel): boolean {
  return FRONTIER_PATTERN.test(m.api_identifier.toLowerCase());
}

function isCategory(value: string | null): value is CategoryFilter {
  return CATEGORIES.some((c) => c.value === value);
}

function isSortKey(value: string | null): value is SortKey {
  return SORT_KEYS.some((k) => k === value);
}

function compareModels(a: CatalogModel, b: CatalogModel, key: SortKey, asc: boolean): number {
  // Unpublished release dates always sink to the bottom, whatever the direction.
  if (key === "release_date" && (!a.release_date || !b.release_date)) {
    if (a.release_date) return -1;
    if (b.release_date) return 1;
    return a.name.localeCompare(b.name);
  }
  let cmp = 0;
  if (key === "name") cmp = formatModelName(a.name).localeCompare(formatModelName(b.name));
  else if (key === "vendor") cmp = formatVendor(a.vendor).localeCompare(formatVendor(b.vendor));
  else if (key === "pricing_input") cmp = a.pricing_input - b.pricing_input;
  else if (key === "context_window") cmp = a.context_window - b.context_window;
  else cmp = (a.release_date ?? "").localeCompare(b.release_date ?? "");
  if (cmp === 0) cmp = a.name.localeCompare(b.name);
  return asc ? cmp : -cmp;
}

/** Page numbers with gaps, e.g. 1 … 7 8 9 … 27. */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

/**
 * Release dates are calendar dates ("YYYY-MM-DD"), parsed as UTC midnight. Formatting in UTC keeps
 * the server render (UTC) and the browser render (local zone) on the same day, so no hydration mismatch.
 */
function formatReleaseDate(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Opaque surfaces for the sticky name column (row hover is bg-muted/50 over bg-card). */
const STICKY_CELL =
  "max-md:sticky max-md:z-10 max-md:bg-card max-md:group-hover:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] max-md:transition-shadow";
const STICKY_HEAD = "max-md:sticky max-md:z-20 max-md:bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))]";
const STICKY_EDGE =
  "max-md:shadow-[inset_-1px_0_0_var(--border),8px_0_12px_-8px_color-mix(in_oklab,var(--foreground)_30%,transparent)]";

interface SyncResponse {
  success?: boolean;
  error?: string;
  data?: { totalDiscovered?: number; newModelsAdded?: number };
}

interface SortHeaderProps {
  label: string;
  field: SortKey;
  activeKey: SortKey;
  asc: boolean;
  align?: "left" | "right";
  className?: string;
  onSort: (field: SortKey) => void;
}

function SortHeader({ label, field, activeKey, asc, align = "left", className, onSort }: SortHeaderProps) {
  const active = activeKey === field;
  const Icon = !active ? ArrowUpDown : asc ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (asc ? "ascending" : "descending") : "none"}
      className={cn("px-5 py-3", align === "right" ? "text-right" : "text-left", className)}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon className={cn("h-3 w-3", active ? "text-brand" : "opacity-60")} />
      </button>
    </th>
  );
}

function StaticHeader({ label, align = "left" }: { label: string; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      {label}
    </th>
  );
}

export function ModelsClient({ models }: { models: CatalogModel[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  // --- URL state (invariant 5: filters/sort/search/page live in the URL) ---
  const categoryParam = searchParams.get("category");
  const category: CategoryFilter = isCategory(categoryParam) ? categoryParam : "all";
  const vendor = searchParams.get("vendor") ?? "all";
  const sortParam = searchParams.get("sort");
  const sortKey: SortKey = isSortKey(sortParam) ? sortParam : "name";
  const sortAsc = searchParams.get("dir") !== "desc";
  const watchlistOnly = searchParams.get("watchlist") === "1";
  const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10);

  // The search box keeps a local copy so typing stays smooth; it re-syncs whenever the URL's
  // ?q= changes from outside (e.g. a deep link from the topbar search or back/forward).
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  const [isSyncing, setIsSyncing] = useState(false);
  // Horizontal scroll offset of the table; drives the sticky name column's edge shadow on phones.
  const [tableScrolled, setTableScrolled] = useState(false);

  /**
   * Shallow URL update (no server round-trip). Next.js keeps useSearchParams in sync with
   * native history calls. Discrete filter changes push history so back/forward works;
   * keystrokes in the search box replace the current entry.
   */
  function updateParams(patch: Record<string, string | null>, options: { resetPage?: boolean; replace?: boolean } = {}) {
    const { resetPage = true, replace = false } = options;
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete("page");
    const qs = next.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }

  function handleSearch(value: string) {
    setQuery(value);
    setSyncedQuery(value);
    updateParams({ q: value.trim() ? value : null }, { replace: true });
  }

  function setCategory(value: CategoryFilter) {
    updateParams({ category: value === "all" ? null : value });
  }

  function setVendor(value: string) {
    updateParams({ vendor: value === "all" ? null : value });
  }

  function toggleSort(field: SortKey) {
    const asc = sortKey === field ? !sortAsc : true;
    updateParams({ sort: field === "name" ? null : field, dir: asc ? null : "desc" });
  }

  function goToPage(p: number) {
    updateParams({ page: p <= 1 ? null : String(p) }, { resetPage: false });
  }

  function clearFilters() {
    setQuery("");
    setSyncedQuery("");
    window.history.pushState(null, "", pathname);
  }

  async function handleSyncModels() {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/models/sync", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as SyncResponse;
      if (!res.ok || !data.success) throw new Error(data.error || "Sync failed");
      toast.success(`Synced ${data.data?.totalDiscovered ?? 0} models from OpenRouter`, {
        description: `${data.data?.newModelsAdded ?? 0} newly added`,
      });
      router.refresh();
    } catch (err: unknown) {
      toast.error("Couldn't sync models", {
        description: err instanceof Error && err.message ? err.message : "Please try again.",
      });
    } finally {
      setIsSyncing(false);
    }
  }

  const vendors = Array.from(new Set(models.map((m) => formatVendor(m.vendor)))).sort((a, b) =>
    a.localeCompare(b)
  );
  const frontierCount = models.filter(isFrontierModel).length;

  // --- Filter + sort ---
  const needle = query.trim().toLowerCase();
  const filtered = models
    .filter((m) => {
      const matchSearch =
        !needle ||
        m.name.toLowerCase().includes(needle) ||
        m.vendor.toLowerCase().includes(needle) ||
        formatVendor(m.vendor).toLowerCase().includes(needle) ||
        m.api_identifier.toLowerCase().includes(needle);
      const matchCategory =
        category === "all" ? true : category === "frontier" ? isFrontierModel(m) : m.category === category;
      const matchVendor = vendor === "all" || formatVendor(m.vendor) === vendor;
      const matchWatchlist = !watchlistOnly || isFavorite(m.id);
      return matchSearch && matchCategory && matchVendor && matchWatchlist;
    })
    .sort((a, b) => compareModels(a, b, sortKey, sortAsc));

  // --- Paginate ---
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const page = Math.min(Math.max(1, Number.isFinite(pageParam) ? pageParam : 1), totalPages);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const hasActiveFilters = Boolean(needle) || category !== "all" || vendor !== "all" || watchlistOnly;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Models</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Browse <span className="font-mono tabular-nums">{models.length}</span> AI models across{" "}
            <span className="font-mono tabular-nums">{vendors.length}</span> vendors.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncModels}
            disabled={isSyncing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.98] disabled:opacity-50"
          >
            {isSyncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            Sync OpenRouter
          </button>
          <Badge
            variant="outline"
            className="h-8 rounded-full border-border px-3 text-xs font-medium text-muted-foreground"
          >
            <Layers className="h-3 w-3" />
            <span className="font-mono tabular-nums">{filtered.length}</span> results
          </Badge>
        </div>
      </div>

      {/* Frontier flagships spotlight */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-brand" />
            <h2 className="text-xs font-medium text-foreground">Frontier flagships spotlight</h2>
            <span className="hidden text-[10px] text-muted-foreground sm:inline">•</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">Live on OpenRouter API</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSyncedQuery("");
              updateParams({ category: "frontier", q: null });
            }}
            className="whitespace-nowrap text-xs font-medium text-brand transition-colors hover:underline"
          >
            Filter all frontier models (<span className="font-mono tabular-nums">{frontierCount}</span>) →
          </button>
        </div>

        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 xl:mx-0 xl:grid xl:grid-cols-5 xl:gap-4 xl:overflow-visible xl:px-0 xl:pb-0 [&::-webkit-scrollbar]:hidden">
          {FRONTIER_SPOTLIGHT.map((f) => {
            const match = models.find((m) => m.api_identifier === f.id);
            const name = match ? formatModelName(match.name) : f.name;
            const vendorName = formatVendor(match?.vendor ?? f.vendor);
            const content = (
              <>
                <span className="w-fit max-w-full truncate rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                  {f.badge}
                </span>
                <div className="min-w-0">
                  <p
                    title={match?.name ?? name}
                    className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-brand"
                  >
                    {name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: getVendorColor(vendorName) }}
                    />
                    <span className="truncate">{vendorName}</span>
                  </p>
                </div>
                <div className="mt-auto flex items-end justify-between gap-2 border-t border-border pt-2.5 text-xs">
                  <div className="min-w-0 font-mono leading-5 tabular-nums text-muted-foreground">
                    <p className="whitespace-nowrap">
                      <span className="text-foreground">{formatContext(match?.context_window ?? f.context)}</span> ctx
                    </p>
                    <p className="whitespace-nowrap">
                      <span className="text-foreground">{formatPricePerMillion(match?.pricing_input ?? f.price)}</span> in
                    </p>
                  </div>
                  {match && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap font-medium text-foreground transition-colors group-hover:text-brand">
                      View <ArrowRight className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </>
            );
            const cardClass =
              "group flex w-[72%] shrink-0 snap-start flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all sm:w-[42%] md:w-[31%] xl:w-auto xl:min-w-0";
            return match ? (
              <Link
                key={f.id}
                href={`/dashboard/models/${match.id}`}
                className={cn(
                  cardClass,
                  "outline-none hover:border-foreground/20 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50"
                )}
              >
                {content}
              </Link>
            ) : (
              <div key={f.id} className={cn(cardClass, "opacity-70")}>
                {content}
              </div>
            );
          })}
        </div>
      </section>

      {/* Toolbar */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search models"
              placeholder="Search models, vendors, IDs…"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 bg-card pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => handleSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <select
              aria-label="Filter by vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-48 sm:flex-none"
            >
              <option value="all">All vendors</option>
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-pressed={watchlistOnly}
              onClick={() => updateParams({ watchlist: watchlistOnly ? null : "1" })}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-all active:scale-[0.98]",
                watchlistOnly
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Star className={cn("h-3.5 w-3.5", watchlistOnly ? "fill-current" : "")} />
              Watchlist
              <span className="font-mono text-xs tabular-nums opacity-70">{favorites.length}</span>
            </button>
          </div>
        </div>

        {/* Category pills: scroll horizontally with a fade edge when they don't fit. */}
        <div className="-mx-4 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-32px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-2 pr-6">
            {CATEGORIES.map((c) => {
              const isActive = category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setCategory(c.value)}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all active:scale-[0.98]",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div
          className={cn("overflow-x-auto", paginated.length === 0 && "hidden")}
          onScroll={(e) => setTableScrolled(e.currentTarget.scrollLeft > 0)}
        >
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b border-border">
                <th scope="col" className={cn("w-12 px-4 py-3 max-md:left-0 max-md:w-10 max-md:min-w-10 max-md:px-2", STICKY_HEAD)}>
                  <span className="sr-only">Watchlist</span>
                </th>
                <SortHeader
                  label="Model"
                  field="name"
                  activeKey={sortKey}
                  asc={sortAsc}
                  onSort={toggleSort}
                  className={cn("max-md:left-10 max-md:pl-1 max-md:pr-3", STICKY_HEAD, tableScrolled && STICKY_EDGE)}
                />
                <SortHeader label="Vendor" field="vendor" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} />
                <StaticHeader label="Category" />
                <SortHeader label="Context" field="context_window" activeKey={sortKey} asc={sortAsc} align="right" onSort={toggleSort} />
                <SortHeader label="Input $/1M" field="pricing_input" activeKey={sortKey} asc={sortAsc} align="right" onSort={toggleSort} />
                <StaticHeader label="Output $/1M" align="right" />
                <SortHeader label="Released" field="release_date" activeKey={sortKey} asc={sortAsc} align="right" onSort={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((model) => {
                const favorite = isFavorite(model.id);
                const vendorName = formatVendor(model.vendor);
                return (
                  <tr key={model.id} className="group transition-colors hover:bg-muted/50">
                    <td className={cn("px-4 py-3 text-center max-md:left-0 max-md:w-10 max-md:min-w-10 max-md:px-2", STICKY_CELL)}>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(model.id)}
                        aria-pressed={favorite}
                        aria-label={favorite ? `Remove ${model.name} from watchlist` : `Add ${model.name} to watchlist`}
                        title={favorite ? "Remove from watchlist" : "Add to watchlist"}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground active:scale-[0.95]"
                      >
                        <Star className={cn("h-4 w-4", favorite && "fill-warning text-warning")} />
                      </button>
                    </td>
                    <td
                      className={cn(
                        "max-w-[300px] px-5 py-3 max-md:left-10 max-md:max-w-[168px] max-md:pl-1 max-md:pr-3",
                        STICKY_CELL,
                        tableScrolled && STICKY_EDGE
                      )}
                    >
                      <Link
                        href={`/dashboard/models/${model.id}`}
                        title={model.name}
                        className="block truncate text-sm font-medium text-foreground transition-colors hover:text-brand"
                      >
                        {formatModelName(model.name)}
                      </Link>
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{model.api_identifier}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: getVendorColor(vendorName) }}
                        />
                        {vendorName}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-foreground">
                        {model.category === "moe" ? "MoE" : model.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {formatContext(model.context_window)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-sm tabular-nums">
                      {model.pricing_input === 0 ? (
                        <span className="font-medium text-success">Free</span>
                      ) : (
                        <span className="text-muted-foreground">{formatCost(model.pricing_input)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-sm tabular-nums">
                      {model.pricing_output === 0 ? (
                        <span className="font-medium text-success">Free</span>
                      ) : (
                        <span className="text-muted-foreground">{formatCost(model.pricing_output)}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {model.release_date ? (
                        formatReleaseDate(model.release_date)
                      ) : (
                        <span title="Release date not published by the provider" className="text-muted-foreground/50">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Empty state lives outside the wide table so it stays centered on phones. */}
        {paginated.length === 0 && (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-medium text-foreground">No models match your filters.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {watchlistOnly && favorites.length === 0
                ? "Your watchlist is empty. Star a model to add it."
                : "Try a different search term or category."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-mono tabular-nums">{(page - 1) * ITEMS_PER_PAGE + 1}</span>–
            <span className="font-mono tabular-nums">{Math.min(page * ITEMS_PER_PAGE, filtered.length)}</span> of{" "}
            <span className="font-mono tabular-nums">{filtered.length}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground transition-all hover:bg-muted active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageWindow(page, totalPages).map((p, i) =>
              p === "gap" ? (
                <span key={`gap-${i}`} className="w-6 text-center text-sm text-muted-foreground">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => goToPage(p)}
                  aria-current={page === p ? "page" : undefined}
                  className={cn(
                    "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 font-mono text-sm font-medium tabular-nums transition-all active:scale-[0.98]",
                    page === p
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border text-foreground hover:bg-muted"
                  )}
                >
                  {p}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              aria-label="Next page"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground transition-all hover:bg-muted active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
