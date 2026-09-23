"use client";

import { TopModelsChart, type TopModelsChartDatum } from "@/components/charts/top-models-chart";

interface DashboardChartsProps {
  data: TopModelsChartDatum[];
}

/**
 * Client boundary for the overview's top-models panel. The default "Ranked" view is plain markup;
 * Recharts (the "Bars" view) is code-split inside TopModelsChart and only loads on demand.
 */
export function DashboardCharts({ data }: DashboardChartsProps) {
  return <TopModelsChart data={data} label="Accuracy %" metric="accuracy" height={280} />;
}
