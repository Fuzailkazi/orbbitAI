"use client";

import { AccuracyBarChart, type AccuracyBarDatum } from "@/components/charts/accuracy-bar-chart";

interface ModelBenchmarkChartProps {
  data: AccuracyBarDatum[];
}

export function ModelBenchmarkChart({ data }: ModelBenchmarkChartProps) {
  if (data.length === 0) return null;
  return <AccuracyBarChart data={data} height={Math.max(200, data.length * 44)} />;
}
