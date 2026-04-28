import { Card, CardContent } from "@/components/ui/card";
import { Play } from "lucide-react";

export default function EvaluationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Evaluations</h1>
        <p className="mt-1 text-sm text-slate-500">Run and track AI model benchmarks.</p>
      </div>
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <Play className="h-10 w-10 text-slate-300 mb-4" />
          <p className="text-sm font-medium text-slate-700">Evaluation engine coming in Phase 4</p>
          <p className="mt-1 text-xs text-slate-400 max-w-xs text-center">
            Select a model and benchmark, then run a real evaluation via OpenRouter. Track accuracy, latency, cost, and failure rate with per-prompt drill-down.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
