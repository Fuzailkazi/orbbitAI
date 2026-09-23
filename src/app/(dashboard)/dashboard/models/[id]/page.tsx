import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  ChevronRight,
  Cpu,
  DollarSign,
  Globe,
  Tag,
  TrendingUp,
  Zap,
} from "lucide-react";
import { getCompletedEvaluationsForModel, getModelById } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { AccuracyWithCI } from "@/components/evaluations/accuracy-with-ci";
import {
  formatContext,
  formatLatency,
  formatModelName,
  formatNumber,
  formatPricePerMillion,
  formatVendor,
  resolveCI,
  scoredQuestionCount,
} from "@/lib/format";
import { getVendorColor } from "@/lib/vendor-colors";
import { ModelBenchmarkChart } from "./model-benchmark-chart";
import { ModelFavoriteButton } from "./model-favorite-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const model = await getModelById(id);
  if (!model) return { title: "Model not found" };
  return {
    title: formatModelName(model.name),
    description: model.description ? stripMarkdownLinks(model.description) : `Benchmarks, pricing and specs for ${model.name} (${model.api_identifier}).`,
  };
}

/** OpenRouter descriptions contain markdown links; show just the link text. */
function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

function formatCategory(category: string): string {
  if (category === "moe") return "MoE";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Both reads are cached (model row: catalog profile; completed evaluations: one shared entry,
  // filtered in memory). Completed scores are immutable, so caching them is safe (rule 5).
  const [m, evals] = await Promise.all([getModelById(id), getCompletedEvaluationsForModel(id)]);
  if (!m) notFound();

  const evaluations = evals.map((ev) => ({
    ...ev,
    ci: resolveCI(ev),
    benchmarkName: ev.benchmarks?.name ?? "Unknown benchmark",
  }));

  const chartData = evaluations
    .filter((ev) => ev.ci.accuracy !== null)
    .map((ev) => ({
      name: ev.benchmarkName,
      accuracy: ev.ci.accuracy ?? 0,
      ci_lower: ev.ci.lower,
      ci_upper: ev.ci.upper,
    }));

  const vendorName = formatVendor(m.vendor);
  const details = [
    { label: "Vendor", value: vendorName, icon: Globe },
    { label: "Category", value: formatCategory(m.category), icon: Tag },
    { label: "Context Window", value: `${formatContext(m.context_window)} tokens`, icon: Cpu, mono: true },
    { label: "Input Pricing", value: formatPricePerMillion(m.pricing_input), icon: DollarSign, mono: true },
    { label: "Output Pricing", value: formatPricePerMillion(m.pricing_output), icon: DollarSign, mono: true },
    {
      label: "Released",
      value: m.release_date
        ? new Date(m.release_date).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            // Calendar date parsed as UTC midnight: format in UTC so it never shifts a day.
            timeZone: "UTC",
          })
        : "Not published",
      icon: Calendar,
      muted: !m.release_date,
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/models"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Models
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="break-words text-2xl font-semibold tracking-tight text-foreground">
              {formatModelName(m.name)}
            </h1>
            <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
              {formatCategory(m.category)}
            </span>
          </div>
          <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: getVendorColor(vendorName) }}
              />
              {vendorName}
            </span>
            <span aria-hidden className="text-muted-foreground/50">
              •
            </span>
            <span className="break-all font-mono text-xs">{m.api_identifier}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ModelFavoriteButton modelId={m.id} />
          <Link
            href={`/dashboard/compare?model=${m.id}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            Compare
          </Link>
          <Link
            href={`/dashboard/evaluate?model=${m.id}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Zap className="h-3.5 w-3.5" /> Run Evaluation
          </Link>
        </div>
      </div>

      {m.description && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm leading-relaxed text-foreground/80">{stripMarkdownLinks(m.description)}</p>
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {details.map((d) => (
          <div key={d.label} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="hidden h-10 w-10 shrink-0 sm:flex items-center justify-center rounded-lg bg-muted">
              <d.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{d.label}</p>
              <p
                className={`mt-0.5 truncate text-sm font-medium ${d.muted ? "text-muted-foreground" : "text-foreground"} ${d.mono ? "font-mono tabular-nums" : ""}`}
              >
                {d.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tags */}
      {m.tags.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Tags</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {m.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="border-border bg-muted text-xs font-medium text-muted-foreground">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Accuracy chart */}
      {chartData.length > 0 && (
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <header className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-4">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Accuracy by Benchmark</h2>
            <span className="ml-auto text-xs text-muted-foreground">Whiskers show Wilson 95% CI</span>
          </header>
          <div className="p-5">
            <ModelBenchmarkChart data={chartData} />
          </div>
        </section>
      )}

      {/* Benchmark results */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-4">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Benchmark Results</h2>
          <Badge variant="outline" className="ml-auto border-border font-mono tabular-nums text-muted-foreground">
            {evaluations.length} {evaluations.length === 1 ? "benchmark" : "benchmarks"}
          </Badge>
        </header>
        {evaluations.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-muted/40">
                  <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-5 py-2.5 text-left">Benchmark</th>
                    <th scope="col" className="px-5 py-2.5 text-right">Accuracy (95% CI)</th>
                    <th scope="col" className="px-5 py-2.5 text-right">Questions</th>
                    <th scope="col" className="px-5 py-2.5 text-right">Avg Latency</th>
                    <th scope="col" className="px-5 py-2.5 text-right">P95</th>
                    <th scope="col" className="px-5 py-2.5 text-right">TPS</th>
                    <th scope="col" className="w-10 px-3 py-2.5">
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {evaluations.map((ev) => (
                    <tr key={ev.id} className="group relative transition-colors hover:bg-muted/50">
                      <td className="whitespace-nowrap px-5 py-3">
                        <Link
                          href={`/dashboard/evaluations/${ev.id}`}
                          className="font-medium text-foreground outline-none transition-colors after:absolute after:inset-0 group-hover:text-brand focus-visible:underline"
                        >
                          {ev.benchmarkName}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <AccuracyWithCI
                          accuracy={ev.ci.accuracy}
                          lower={ev.ci.lower}
                          upper={ev.ci.upper}
                          ciFormat="range"
                        />
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {formatNumber(ev.questions_correct)}/{formatNumber(scoredQuestionCount(ev))}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {formatLatency(ev.avg_latency_ms)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {formatLatency(ev.p95_latency_ms)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {formatNumber(ev.tokens_per_second, ev.tokens_per_second !== null && ev.tokens_per_second < 10 ? 1 : 0)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
              Select a benchmark to inspect every prompt, response and score behind the aggregate.
            </p>
          </>
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-foreground">No evaluations yet for {formatModelName(m.name)}.</p>
            <p className="mt-1 text-xs text-muted-foreground">Run a benchmark to see accuracy, latency and cost here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
