import { Card, CardContent } from "@/components/ui/card";
import { LayoutGrid } from "lucide-react";

export default function SpacesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Eval Spaces</h1>
        <p className="mt-1 text-sm text-slate-500">Curated benchmark groups for focused evaluation.</p>
      </div>
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <LayoutGrid className="h-10 w-10 text-slate-300 mb-4" />
          <p className="text-sm font-medium text-slate-700">Spaces coming in Phase 5</p>
          <p className="mt-1 text-xs text-slate-400 max-w-xs text-center">
            Spaces group benchmarks into categories like Mathematics, Code Generation, and Reasoning. They will show aggregated scores after evaluations are run.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
