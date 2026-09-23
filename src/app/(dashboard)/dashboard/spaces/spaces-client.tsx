"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { toast } from "sonner";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  Calculator,
  Check,
  CheckCircle,
  Code,
  Loader2,
  MessageCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { AccuracyWithCI } from "@/components/evaluations/accuracy-with-ci";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatModelName, formatNumber, formatVendor } from "@/lib/format";
import { getVendorColor } from "@/lib/vendor-colors";
import { cn } from "@/lib/utils";
import type { Benchmark, Space } from "@/types/database";

export type SpaceBenchmarkOption = Pick<Benchmark, "id" | "name" | "category">;

interface PooledAccuracy {
  accuracy: number | null;
  lower: number | null;
  upper: number | null;
  /** Total questions pooled into the interval. */
  questions: number;
}

export interface SpaceStat {
  space: Space;
  benchmarks: SpaceBenchmarkOption[];
  evaluationCount: number;
  modelCount: number;
  pooled: PooledAccuracy;
  top: (PooledAccuracy & { id: string; name: string; vendor: string }) | null;
  /** Curated seed spaces are read-only (the API returns 403 PROTECTED_RESOURCE). */
  isCurated: boolean;
}

interface ApiResponse {
  success?: boolean;
  error?: string;
}

const SPACE_ICONS: Record<string, typeof Calculator> = {
  brain: Brain,
  code: Code,
  calculator: Calculator,
  "message-circle": MessageCircle,
  "check-circle": CheckCircle,
  bot: Bot,
  "layout-grid": BarChart3,
};

const ICON_OPTIONS = [
  { label: "Reasoning", value: "brain" },
  { label: "Code", value: "code" },
  { label: "Math", value: "calculator" },
  { label: "Chat", value: "message-circle" },
  { label: "Factuality", value: "check-circle" },
  { label: "Agentic", value: "bot" },
] as const;

const LABEL = "mb-1.5 block text-xs font-medium text-muted-foreground";

async function readJson(res: Response): Promise<ApiResponse> {
  try {
    return (await res.json()) as ApiResponse;
  } catch {
    return {};
  }
}

function plural(n: number, noun: string) {
  return `${formatNumber(n)} ${noun}${n === 1 ? "" : "s"}`;
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function SpacesClient({
  benchmarks,
  spaceStats,
}: {
  benchmarks: SpaceBenchmarkOption[];
  spaceStats: SpaceStat[];
}) {
  const router = useRouter();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string>("brain");
  const [selectedBenchmarkIds, setSelectedBenchmarkIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<Space | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function openCreate() {
    setCreateError(null);
    setIsCreateOpen(true);
  }

  function resetCreateForm() {
    setName("");
    setDescription("");
    setIcon("brain");
    setSelectedBenchmarkIds([]);
    setCreateError(null);
  }

  function toggleBenchmark(id: string) {
    setCreateError(null);
    setSelectedBenchmarkIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  }

  async function handleCreateSpace(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setCreateError("Give the space a name.");
      return;
    }
    if (selectedBenchmarkIds.length === 0) {
      setCreateError("Select at least one benchmark.");
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);
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
      const data = await readJson(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create space.");
      }
      toast.success(`Created space “${name.trim()}”`);
      setIsCreateOpen(false);
      resetCreateForm();
      router.refresh();
    } catch (err: unknown) {
      toast.error("Couldn't create the space", { description: errorMessage(err, "Please try again.") });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/spaces?id=${encodeURIComponent(target.id)}`, {
        method: "DELETE",
      });
      const data = await readJson(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete space.");
      }
      toast.success(`Deleted space “${target.name}”`);
      setPendingDelete(null);
      router.refresh();
    } catch (err: unknown) {
      toast.error("Couldn't delete the space", { description: errorMessage(err, "Network error. Please try again.") });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Evaluation spaces</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Domain-focused benchmark clusters. Accuracy is pooled across every question in the
            space, with a Wilson 95% confidence interval.{" "}
            <Link href="/docs#spaces" className="font-medium text-brand hover:underline">
              How to use Spaces
            </Link>
          </p>
        </div>
        <Button size="lg" onClick={openCreate} className="w-fit px-4">
          <Plus data-icon="inline-start" /> Create space
        </Button>
      </div>

      {/* Grid */}
      {spaceStats.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
          <p className="text-sm font-medium text-foreground">No spaces yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Group benchmarks into a space to track aggregate performance for a domain.
          </p>
          <Button size="lg" onClick={openCreate} className="mt-4 px-4">
            <Plus data-icon="inline-start" /> Create space
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {spaceStats.map(({ space, benchmarks: spaceBenchmarks, evaluationCount, modelCount, pooled, top, isCurated }) => {
            const Icon = SPACE_ICONS[space.icon] ?? BarChart3;
            return (
              <article
                key={space.id}
                className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-flex h-5 items-center rounded-full border border-border px-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {spaceBenchmarks.length} {spaceBenchmarks.length === 1 ? "benchmark" : "benchmarks"}
                    </span>
                    {isCurated ? (
                      <span
                        title="Curated spaces ship with Orbbit and can't be deleted"
                        className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground"
                      >
                        Curated
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${space.name}`}
                        title="Delete space"
                        onClick={() => setPendingDelete(space)}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </div>

                <h2 className="mt-3 text-base font-semibold text-foreground">{space.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {space.description || "Custom evaluation space"}
                </p>

                <div className="mt-3 flex flex-wrap gap-1">
                  {spaceBenchmarks.map((b) => (
                    <Link
                      key={b.id}
                      href={`/dashboard/evaluations?benchmark=${encodeURIComponent(b.name)}`}
                      title={`View ${b.name} evaluations`}
                      className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground/80 transition-colors hover:border-brand/30 hover:text-brand"
                    >
                      {b.name}
                    </Link>
                  ))}
                </div>

                <div className="mt-4 flex-1">
                  {evaluationCount > 0 ? (
                    <dl className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground" title="Correct answers ÷ questions, summed over every completed evaluation in this space">
                          Pooled accuracy
                        </dt>
                        <dd>
                          <AccuracyWithCI
                            accuracy={pooled.accuracy}
                            lower={pooled.lower}
                            upper={pooled.upper}
                            ciFormat="range"
                          />
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">Coverage</dt>
                        <dd className="font-mono tabular-nums text-foreground">
                          {plural(evaluationCount, "run")} · {plural(modelCount, "model")}
                          {pooled.questions > 0 && (
                            <span className="text-muted-foreground"> · {formatNumber(pooled.questions)} q</span>
                          )}
                        </dd>
                      </div>
                      {top && (
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="shrink-0 text-muted-foreground" title="Highest Wilson lower bound across this space's benchmarks">
                            Top model
                          </dt>
                          <dd className="flex min-w-0 items-baseline gap-2">
                            <Link
                              href={`/dashboard/models/${top.id}`}
                              className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground transition-colors hover:text-brand"
                              title={`${formatModelName(top.name)} · ${formatVendor(top.vendor)}`}
                            >
                              <span
                                aria-hidden
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: getVendorColor(top.vendor) }}
                              />
                              <span className="truncate">{formatModelName(top.name)}</span>
                            </Link>
                            <AccuracyWithCI
                              accuracy={top.accuracy}
                              lower={top.lower}
                              upper={top.upper}
                              size="xs"
                              className="shrink-0"
                            />
                          </dd>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                      No completed evaluations for these benchmarks yet.
                    </div>
                  )}
                </div>

                <Link
                  href={
                    spaceBenchmarks.length === 1
                      ? `/dashboard/leaderboard?benchmark=${encodeURIComponent(spaceBenchmarks[0].name)}`
                      : "/dashboard/leaderboard"
                  }
                  className="mt-4 inline-flex w-fit items-center gap-1 text-xs font-medium text-brand transition-colors hover:text-brand/80"
                >
                  View in leaderboard <ArrowRight className="h-3 w-3" />
                </Link>
              </article>
            );
          })}
        </div>
      )}

      {/* Create space dialog */}
      <Dialog.Root
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (isSubmitting) return;
          setIsCreateOpen(open);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(90dvh,720px)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl outline-none transition-all duration-150 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold text-foreground">
                  Create evaluation space
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                  Group benchmarks to measure pooled performance for a domain.
                </Dialog.Description>
              </div>
              <Dialog.Close
                render={<Button variant="ghost" size="icon-sm" aria-label="Close" disabled={isSubmitting} />}
              >
                <X />
              </Dialog.Close>
            </div>

            <form onSubmit={handleCreateSpace} noValidate className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div>
                  <label htmlFor="space-name" className={LABEL}>
                    Name
                  </label>
                  <Input
                    id="space-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setCreateError(null);
                    }}
                    placeholder="e.g. Financial analysis or SQL assistants"
                    maxLength={80}
                    autoComplete="off"
                    className="h-9"
                  />
                </div>

                <div>
                  <label htmlFor="space-description" className={LABEL}>
                    Description <span className="font-normal">(optional)</span>
                  </label>
                  <Textarea
                    id="space-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What capabilities does this space measure?"
                    rows={2}
                    maxLength={240}
                  />
                </div>

                <fieldset>
                  <legend className={LABEL}>Icon</legend>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                    {ICON_OPTIONS.map((opt) => {
                      const OptIcon = SPACE_ICONS[opt.value];
                      const active = icon === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={active}
                          title={opt.label}
                          onClick={() => setIcon(opt.value)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] transition-colors",
                            active
                              ? "border-brand/40 bg-brand/10 text-brand"
                              : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <OptIcon className="h-4 w-4" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-1.5 flex w-full items-baseline justify-between gap-2 text-xs font-medium text-muted-foreground">
                    Benchmarks
                    <span className="font-mono text-[11px] font-normal tabular-nums">
                      {selectedBenchmarkIds.length} selected
                    </span>
                  </legend>
                  <div className="grid max-h-52 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border border-border bg-muted/40 p-2 min-[420px]:grid-cols-2">
                    {benchmarks.map((b) => {
                      const selected = selectedBenchmarkIds.includes(b.id);
                      return (
                        <button
                          type="button"
                          key={b.id}
                          aria-pressed={selected}
                          onClick={() => toggleBenchmark(b.id)}
                          className={cn(
                            "flex min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                            selected
                              ? "border-brand/40 bg-brand/10 font-medium text-foreground"
                              : "border-border bg-card text-foreground/80 hover:bg-muted"
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border",
                              selected ? "border-brand bg-brand text-brand-foreground" : "border-input bg-background"
                            )}
                          >
                            {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                          </span>
                          <span className="truncate">{b.name}</span>
                          <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {b.category}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {createError && (
                  <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                    {createError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">
                <Dialog.Close
                  render={<Button type="button" variant="outline" size="lg" disabled={isSubmitting} />}
                >
                  Cancel
                </Dialog.Close>
                <Button type="submit" size="lg" disabled={isSubmitting} className="px-4">
                  {isSubmitting && <Loader2 data-icon="inline-start" className="animate-spin" />}
                  Create space
                </Button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirmation dialog */}
      <Dialog.Root
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDelete(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
          <Dialog.Popup
            role="alertdialog"
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-xl outline-none transition-all duration-150 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Trash2 className="h-4 w-4" />
            </div>
            <Dialog.Title className="mt-3 text-base font-semibold text-foreground">
              Delete “{pendingDelete?.name}”?
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              The space is removed for everyone. Benchmarks and evaluation results are not affected.
            </Dialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close
                render={<Button type="button" variant="outline" size="lg" disabled={isDeleting} />}
              >
                Cancel
              </Dialog.Close>
              <Button
                type="button"
                size="lg"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="bg-destructive px-4 text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting && <Loader2 data-icon="inline-start" className="animate-spin" />}
                Delete space
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
