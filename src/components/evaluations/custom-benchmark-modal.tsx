"use client";

import { useState } from "react";
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CustomBenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (benchmark: { id: string; name: string; category: string; scoring_method: string }) => void;
}

const SAMPLE_DATASET = [
  {
    prompt: "Given a PostgreSQL table 'orders(id, user_id, amount, created_at)', write a query to find the total revenue grouped by month for 2025.",
    expected_answer: "SELECT DATE_TRUNC('month', created_at) AS month, SUM(amount) AS total_revenue FROM orders WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01' GROUP BY DATE_TRUNC('month', created_at) ORDER BY month;",
  },
  {
    prompt: "What HTTP status code should a server return when a client makes too many requests within a given time frame?",
    expected_answer: "429",
  },
  {
    prompt: "In React, which hook should be used to store a mutable reference that does not trigger a re-render when changed?",
    expected_answer: "useRef",
  },
  {
    prompt: "What is the time complexity of searching an element in a balanced Binary Search Tree (AVL or Red-Black tree) with N nodes?",
    expected_answer: "O(log n)",
  },
];

export function CustomBenchmarkModal({ isOpen, onClose, onCreated }: CustomBenchmarkModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scoringMethod, setScoringMethod] = useState("exact_match");
  const [questions, setQuestions] = useState<Array<{ prompt: string; expected_answer: string }>>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleLoadSample() {
    setName("Enterprise Full-Stack QA (Sample)");
    setDescription("Standardized software architecture and engineering queries");
    setScoringMethod("normalized_match");
    setQuestions(SAMPLE_DATASET);
    setFileName("sample_enterprise_qa.csv");
    setError(null);
  }

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error("CSV must contain a header row and at least one data row.");
    }

    const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
    const promptIdx = header.findIndex((h) => h.includes("prompt") || h.includes("question"));
    const answerIdx = header.findIndex((h) => h.includes("answer") || h.includes("expected") || h.includes("ground_truth"));

    if (promptIdx === -1 || answerIdx === -1) {
      throw new Error("CSV must contain 'prompt' (or 'question') and 'expected_answer' (or 'answer') columns.");
    }

    const parsed: Array<{ prompt: string; expected_answer: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Basic CSV field extraction handling quotes
      const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(line)) !== null) {
        if (match.index === regex.lastIndex) regex.lastIndex++;
        let val = match[1] ?? "";
        if (val.startsWith(",") || val.startsWith("\n")) val = val.slice(1);
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1).replace(/""/g, '"');
        }
        matches.push(val.trim());
      }

      if (matches.length > Math.max(promptIdx, answerIdx)) {
        const p = matches[promptIdx];
        const a = matches[answerIdx];
        if (p && a) {
          parsed.push({ prompt: p, expected_answer: a });
        }
      }
    }

    if (parsed.length === 0) {
      throw new Error("No valid rows could be extracted from the CSV file.");
    }

    return parsed;
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        if (file.name.endsWith(".json")) {
          const json = JSON.parse(content);
          if (!Array.isArray(json)) throw new Error("JSON must be an array of objects.");
          const parsed = json.map((item: any) => ({
            prompt: String(item.prompt || item.question || ""),
            expected_answer: String(item.expected_answer || item.answer || ""),
          })).filter((q) => q.prompt && q.expected_answer);
          if (parsed.length === 0) throw new Error("No valid items with prompt & answer found in JSON.");
          setQuestions(parsed);
        } else {
          const parsed = parseCSV(content);
          setQuestions(parsed);
        }
      } catch (err: any) {
        setError(err.message || "Failed to parse file.");
        setQuestions([]);
      }
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (questions.length === 0) {
      setError("Please upload a dataset or load the sample questions.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/benchmarks/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          scoringMethod,
          questions,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create custom benchmark.");
      }

      onCreated(data.data);
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>Bring Your Own Benchmark</span>
              <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px]">
                BYOD
              </Badge>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload custom prompts & expected answers to test AI models against proprietary company data.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Benchmark Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., SaaS SQL Generator QA"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Tests internal database query generation"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Scoring Method
            </label>
            <select
              value={scoringMethod}
              onChange={(e) => setScoringMethod(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="exact_match">Exact Match (Strict regex & option match)</option>
              <option value="normalized_match">Normalized Match (Strips whitespace, symbols & casing)</option>
              <option value="llm_judge">LLM-as-a-Judge (Rubric-based grading with reasoning)</option>
            </select>
          </div>

          {/* Upload Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Dataset File (CSV or JSON)
              </label>
              <button
                type="button"
                onClick={handleLoadSample}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <Sparkles className="h-3 w-3" /> Load Sample Dataset
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-xl p-5 text-center transition-colors bg-slate-50/50">
              <Upload className="mx-auto h-6 w-6 text-slate-400 mb-2" />
              <p className="text-xs font-medium text-slate-700">
                Drag and drop your file here, or{" "}
                <label className="text-indigo-600 hover:underline cursor-pointer font-semibold">
                  browse
                  <input
                    type="file"
                    accept=".csv,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                CSV headers required: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">prompt, expected_answer</code>
              </p>

              {fileName && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 border border-indigo-100">
                  <FileText className="h-3.5 w-3.5" />
                  <span>{fileName}</span>
                  <span className="text-slate-400">•</span>
                  <span>{questions.length} questions parsed</span>
                </div>
              )}
            </div>
          </div>

          {/* Questions Preview */}
          {questions.length > 0 && (
            <div className="rounded-lg border border-slate-200 overflow-hidden text-xs">
              <div className="bg-slate-50 px-3 py-2 font-semibold text-slate-600 border-b border-slate-200 flex justify-between items-center">
                <span>Preview ({questions.length} items)</span>
                <span className="text-[10px] text-slate-400">Showing first 2</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
                {questions.slice(0, 2).map((q, idx) => (
                  <div key={idx} className="p-2.5 space-y-1 bg-white">
                    <p className="font-medium text-slate-800 line-clamp-1">Q: {q.prompt}</p>
                    <p className="text-slate-500 font-mono text-[11px] line-clamp-1">Expected: {q.expected_answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || questions.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Save & Enable for Evals
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
