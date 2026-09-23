"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, FileText, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Shape returned by POST /api/benchmarks/custom. */
export interface CreatedBenchmark {
  id: string;
  name: string;
  category: string;
  scoring_method: string;
  total_questions: number;
}

interface CustomBenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (benchmark: CreatedBenchmark) => void;
}

interface DatasetRow {
  prompt: string;
  expected_answer: string;
}

type CustomScoringMethod = "exact_match" | "normalized_match" | "llm_judge";

const SCORING_OPTIONS: { value: CustomScoringMethod; label: string }[] = [
  { value: "exact_match", label: "Exact match — strict answer / option match" },
  { value: "normalized_match", label: "Normalized match — ignores case, spacing and symbols" },
  { value: "llm_judge", label: "LLM-as-a-judge — rubric grading with reasoning" },
];

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const SAMPLE_DATASET: DatasetRow[] = [
  {
    prompt:
      "Given a PostgreSQL table 'orders(id, user_id, amount, created_at)', write a query to find the total revenue grouped by month for 2025.",
    expected_answer:
      "SELECT DATE_TRUNC('month', created_at) AS month, SUM(amount) AS total_revenue FROM orders WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01' GROUP BY DATE_TRUNC('month', created_at) ORDER BY month;",
  },
  {
    prompt:
      "What HTTP status code should a server return when a client makes too many requests within a given time frame?",
    expected_answer: "429",
  },
  {
    prompt:
      "In React, which hook should be used to store a mutable reference that does not trigger a re-render when changed?",
    expected_answer: "useRef",
  },
  {
    prompt:
      "What is the time complexity of searching an element in a balanced Binary Search Tree (AVL or Red-Black tree) with N nodes?",
    expected_answer: "O(log n)",
  },
];

const LABEL_CLASS = "mb-1.5 block text-xs font-medium text-foreground";

const SELECT_CLASS =
  "h-9 w-full min-w-0 cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

/** RFC 4180-style CSV parser: quoted fields may contain commas, quotes ("") and newlines. */
function parseCSVRecords(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function parseCSV(text: string): DatasetRow[] {
  const records = parseCSVRecords(text.replace(/^﻿/, ""));
  if (records.length < 2) {
    throw new Error("The CSV needs a header row and at least one data row.");
  }

  const header = records[0].map((h) => h.trim().toLowerCase());
  const promptIdx = header.findIndex((h) => h.includes("prompt") || h.includes("question"));
  const answerIdx = header.findIndex(
    (h) => h.includes("answer") || h.includes("expected") || h.includes("ground_truth")
  );
  if (promptIdx === -1 || answerIdx === -1) {
    throw new Error(
      "The CSV must have a 'prompt' (or 'question') column and an 'expected_answer' (or 'answer') column."
    );
  }

  const parsed = records
    .slice(1)
    .map((r) => ({
      prompt: (r[promptIdx] ?? "").trim(),
      expected_answer: (r[answerIdx] ?? "").trim(),
    }))
    .filter((q) => q.prompt && q.expected_answer);

  if (parsed.length === 0) throw new Error("No valid rows could be read from the CSV.");
  return parsed;
}

function pickField(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = item[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" || typeof v === "boolean") return String(v);
  }
  return "";
}

function parseJSON(text: string): DatasetRow[] {
  const json: unknown = JSON.parse(text);
  if (!Array.isArray(json)) throw new Error("The JSON file must be an array of objects.");
  const parsed = json
    .map((item: unknown) => {
      if (typeof item !== "object" || item === null) return { prompt: "", expected_answer: "" };
      const record = item as Record<string, unknown>;
      return {
        prompt: pickField(record, ["prompt", "question"]),
        expected_answer: pickField(record, ["expected_answer", "answer", "ground_truth"]),
      };
    })
    .filter((q) => q.prompt && q.expected_answer);
  if (parsed.length === 0) {
    throw new Error("No items with both a prompt and an answer were found in the JSON.");
  }
  return parsed;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function CustomBenchmarkModal({ isOpen, onClose, onCreated }: CustomBenchmarkModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scoringMethod, setScoringMethod] = useState<CustomScoringMethod>("exact_match");
  const [questions, setQuestions] = useState<DatasetRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setDescription("");
    setScoringMethod("exact_match");
    setQuestions([]);
    setFileName(null);
    setIsDragging(false);
    setError(null);
  }

  function handleLoadSample() {
    setName("Enterprise Full-Stack QA (Sample)");
    setDescription("Standardized software architecture and engineering queries");
    setScoringMethod("normalized_match");
    setQuestions(SAMPLE_DATASET);
    setFileName("sample_enterprise_qa.csv");
    setError(null);
  }

  function readFile(file: File) {
    setError(null);
    setFileName(file.name);

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".json")) {
      setError("Upload a .csv or .json file.");
      setQuestions([]);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("The file is larger than 5 MB.");
      setQuestions([]);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      try {
        setQuestions(lower.endsWith(".json") ? parseJSON(content) : parseCSV(content));
      } catch (err: unknown) {
        setError(errorMessage(err, "The file could not be parsed."));
        setQuestions([]);
      }
    };
    reader.onerror = () => {
      setError("The file could not be read.");
      setQuestions([]);
    };
    reader.readAsText(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again still fires `change`.
    e.target.value = "";
    if (file) readFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (questions.length === 0) {
      setError("Upload a dataset or load the sample questions first.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/benchmarks/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), scoringMethod, questions }),
      });

      const body: unknown = await res.json().catch(() => null);
      const data = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
      if (!res.ok || data.success !== true) {
        const message = typeof data.error === "string" ? data.error : "";
        throw new Error(message || `Could not create the benchmark (status ${res.status}).`);
      }

      const created = data.data as CreatedBenchmark | undefined;
      if (!created?.id) throw new Error("The server did not return the new benchmark.");

      onCreated(created);
      toast.success(`Benchmark “${created.name}” created`, {
        description: `${created.total_questions} ${created.total_questions === 1 ? "question" : "questions"} · selected for your next run`,
      });
      resetForm();
      onClose();
    } catch (err: unknown) {
      toast.error("Couldn't save the benchmark", {
        description: errorMessage(err, "Something went wrong while saving the benchmark."),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-lg outline-none transition-all duration-150 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-border pb-4">
            <div className="min-w-0">
              <Dialog.Title className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
                Bring your own benchmark
                <Badge variant="outline" className="border-brand/20 bg-brand/10 text-[10px] text-brand">
                  BYOD
                </Badge>
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                Upload prompts with expected answers to evaluate models against your own data.
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={<Button variant="ghost" size="icon-sm" className="-mt-1 -mr-1 shrink-0" />}
              disabled={isSubmitting}
            >
              <X />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="byod-name" className={LABEL_CLASS}>
                Benchmark name <span className="text-muted-foreground">(required)</span>
              </label>
              <Input
                id="byod-name"
                type="text"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SaaS SQL generator QA"
                className="h-9"
              />
            </div>

            <div>
              <label htmlFor="byod-description" className={LABEL_CLASS}>
                Description <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="byod-description"
                type="text"
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Tests internal database query generation"
                className="h-9"
              />
            </div>

            <div>
              <label htmlFor="byod-scoring" className={LABEL_CLASS}>
                Scoring method
              </label>
              <select
                id="byod-scoring"
                value={scoringMethod}
                onChange={(e) => setScoringMethod(e.target.value as CustomScoringMethod)}
                className={SELECT_CLASS}
              >
                {SCORING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                The scorer is saved with the benchmark and used for every run.
              </p>
            </div>

            {/* Upload area */}
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">Dataset file (CSV or JSON)</span>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="inline-flex items-center gap-1 rounded-md text-[11px] font-medium text-brand outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Sparkles className="h-3 w-3" /> Load sample dataset
                </button>
              </div>

              <label
                htmlFor="byod-file"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  "block cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors has-[:focus-visible]:border-ring",
                  isDragging
                    ? "border-brand/50 bg-brand/5"
                    : "border-border bg-muted/40 hover:border-brand/30"
                )}
              >
                <input
                  id="byod-file"
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  onChange={handleFileInput}
                  className="sr-only"
                />
                <Upload className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-xs font-medium text-foreground/80">
                  Drop a file here, or <span className="font-semibold text-brand">browse</span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Required columns:{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground/80">
                    prompt, expected_answer
                  </code>
                </p>

                {fileName && (
                  <span className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{fileName}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="shrink-0 font-mono tabular-nums">
                      {questions.length} {questions.length === 1 ? "question" : "questions"}
                    </span>
                  </span>
                )}
              </label>
            </div>

            {/* Preview */}
            {questions.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-border text-xs">
                <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2 font-medium text-foreground/80">
                  <span>Preview ({questions.length} items)</span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    Showing first {Math.min(2, questions.length)}
                  </span>
                </div>
                <div className="max-h-36 divide-y divide-border overflow-y-auto">
                  {questions.slice(0, 2).map((q, idx) => (
                    <div key={idx} className="space-y-1 bg-card p-2.5">
                      <p className="line-clamp-1 font-medium text-foreground">Q: {q.prompt}</p>
                      <p className="line-clamp-1 font-mono text-[11px] text-muted-foreground">
                        Expected: {q.expected_answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
              >
                <AlertCircle className="mt-px h-4 w-4 shrink-0" />
                <span className="min-w-0 [overflow-wrap:anywhere]">{error}</span>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting || questions.length === 0 || !name.trim()}
                className="px-4"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 data-icon="inline-start" className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 data-icon="inline-start" /> Save and enable for evals
                  </>
                )}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
