import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import type { Model } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Globe, Clock, Cpu, DollarSign, Tag, Calendar, Zap,
} from "lucide-react";

const categoryColors: Record<string, string> = {
  chat: "bg-indigo-50 text-indigo-600",
  reasoning: "bg-violet-50 text-violet-600",
  code: "bg-emerald-50 text-emerald-600",
  vision: "bg-amber-50 text-amber-600",
  moe: "bg-pink-50 text-pink-600",
  embedding: "bg-cyan-50 text-cyan-600",
  transformer: "bg-slate-100 text-slate-600",
};

function formatContext(ctx: number): string {
  if (ctx >= 1000000) return `${(ctx / 1000000).toFixed(1)}M tokens`;
  return `${(ctx / 1000).toFixed(0)}K tokens`;
}

function formatPrice(price: number): string {
  if (price === 0) return "Free";
  return `$${price} / 1M tokens`;
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: model, error } = await supabase
    .from("models")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !model) notFound();

  const m = model as Model;

  const details = [
    { label: "Vendor", value: m.vendor, icon: Globe },
    { label: "Category", value: m.category, icon: Tag },
    { label: "Context Window", value: formatContext(m.context_window), icon: Cpu },
    { label: "Input Pricing", value: formatPrice(m.pricing_input), icon: DollarSign },
    { label: "Output Pricing", value: formatPrice(m.pricing_output), icon: DollarSign },
    {
      label: "Released",
      value: m.release_date
        ? new Date(m.release_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "Unknown",
      icon: Calendar,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/models"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Models
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {m.name}
            </h1>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${categoryColors[m.category] ?? "bg-slate-100 text-slate-600"}`}>
              {m.category}
            </span>
            {!m.is_active && (
              <Badge variant="outline" className="border-red-200 text-red-500">Inactive</Badge>
            )}
          </div>
          <p className="mt-1 font-mono text-sm text-slate-400">{m.api_identifier}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/compare?model=${m.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            Compare
          </Link>
          <Link
            href={`/dashboard/evaluations?model=${m.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Zap className="h-3.5 w-3.5" />
            Run Evaluation
          </Link>
        </div>
      </div>

      {/* Description */}
      {m.description && (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm leading-relaxed text-slate-600">{m.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Details grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {details.map((d) => (
          <Card key={d.label} className="border-slate-200 bg-white shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                <d.icon className="h-4 w-4 text-slate-400" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {d.label}
                </p>
                <p className="mt-0.5 text-sm font-medium text-slate-900">{d.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tags */}
      {m.tags.length > 0 && (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-900">Tags</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {m.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-slate-200 bg-slate-50 text-xs font-medium text-slate-600"
              >
                {tag}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Evaluations placeholder */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-900">Evaluations</CardTitle>
          <Badge variant="outline" className="border-slate-200 text-slate-400">
            Coming in Phase 4
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">
            No evaluations yet. Run a benchmark against {m.name} to see accuracy, latency, and cost metrics here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
