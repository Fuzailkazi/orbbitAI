import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, AdminConfigError } from "@/lib/supabase/admin";
import { requireApiSession } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import {
  apiError,
  databaseErrorResponse,
  errorMessage,
  isRecord,
  readJsonObject,
} from "@/lib/api/responses";
import { isSupportedScoringMethod, SUPPORTED_SCORING_METHODS } from "@/lib/eval/scorers/factory";
import { revalidateBenchmarks } from "@/lib/data/revalidate";
import type { BenchmarkQuestionInsert } from "@/types/database";

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_QUESTIONS = 500;
const MAX_PROMPT_LENGTH = 20_000;
const MAX_ANSWER_LENGTH = 10_000;

interface CleanQuestion {
  prompt: string;
  expected_answer: string;
  metadata: Record<string, unknown>;
}

/**
 * pass_at_k executes the response against JavaScript tests (MultiPL-E style: a script that
 * references the function by name and throws on failure), so each code question must carry
 * metadata.tests; its expected_answer may be empty. Every other method needs an expected answer
 * (llm_judge uses it as the reference).
 */
function cleanQuestion(raw: unknown, scoringMethod: string): CleanQuestion | null {
  if (!isRecord(raw)) return null;
  const { prompt, expected_answer: expected, metadata } = raw;
  const isCode = scoringMethod === "pass_at_k";
  if (typeof prompt !== "string") return null;
  if (typeof expected !== "string" && !(isCode && (expected === undefined || expected === null))) return null;

  const cleanPrompt = prompt.trim();
  const cleanExpected = typeof expected === "string" ? expected.trim() : "";
  const cleanMetadata = isRecord(metadata) ? metadata : {};
  if (!cleanPrompt) return null;
  if (!isCode && !cleanExpected) return null;
  if (isCode && (typeof cleanMetadata.tests !== "string" || !cleanMetadata.tests.trim())) return null;
  if (cleanPrompt.length > MAX_PROMPT_LENGTH || cleanExpected.length > MAX_ANSWER_LENGTH) return null;

  return { prompt: cleanPrompt, expected_answer: cleanExpected, metadata: cleanMetadata };
}

/**
 * POST /api/benchmarks/custom — BYOD benchmark upload.
 * { name, description?, scoringMethod?, questions: { prompt, expected_answer, metadata? }[] }
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  // Per-IP, per-instance sliding window (see lib/api/rate-limit.ts).
  const limited = enforceRateLimit(req, "customBenchmark");
  if (limited) return limited;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const { name, description, scoringMethod = "exact_match", questions } = parsed.body;

  if (typeof name !== "string" || name.trim().length === 0) {
    return apiError("Benchmark name is required.", "VALIDATION_ERROR", 400);
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return apiError(`Benchmark name must be ${MAX_NAME_LENGTH} characters or fewer.`, "VALIDATION_ERROR", 400);
  }
  if (description !== undefined && description !== null && typeof description !== "string") {
    return apiError("Description must be a string.", "VALIDATION_ERROR", 400);
  }
  const cleanDescription = (description ?? "").trim().slice(0, MAX_DESCRIPTION_LENGTH);

  // Rule 10: the scoring method is declared by the benchmark and must map to a registered scorer.
  if (!isSupportedScoringMethod(scoringMethod)) {
    return apiError(
      `Unsupported scoring method. Use one of: ${SUPPORTED_SCORING_METHODS.join(", ")}.`,
      "VALIDATION_ERROR",
      400
    );
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return apiError("At least one question is required.", "VALIDATION_ERROR", 400);
  }
  if (questions.length > MAX_QUESTIONS) {
    return apiError(`A custom benchmark can have at most ${MAX_QUESTIONS} questions.`, "VALIDATION_ERROR", 400);
  }

  const validQuestions = questions
    .map((q) => cleanQuestion(q, scoringMethod))
    .filter((q): q is CleanQuestion => q !== null);
  if (validQuestions.length === 0) {
    return apiError(
      scoringMethod === "pass_at_k"
        ? "No valid questions found. pass_at_k questions need a non-empty 'prompt' and JavaScript tests in 'metadata.tests'."
        : "No valid questions found. Each question must have non-empty 'prompt' and 'expected_answer' strings.",
      "VALIDATION_ERROR",
      400
    );
  }

  try {
    const supabase = createAdminClient();

    // 1. Create the benchmark record
    const { data: benchmark, error: bError } = await supabase
      .from("benchmarks")
      .insert({
        name: name.trim(),
        description: cleanDescription || "Custom user-uploaded benchmark suite",
        category: "general",
        scoring_method: scoringMethod,
        total_questions: validQuestions.length,
        source_url: "custom-upload",
      })
      .select("id, name, category, scoring_method, total_questions")
      .single();

    if (bError || !benchmark) {
      return bError
        ? databaseErrorResponse(bError, "Failed to create benchmark")
        : apiError("Failed to create benchmark.", "DATABASE_ERROR", 500);
    }

    const benchmarkId = (benchmark as { id: string }).id;

    // 2. Insert questions
    // Provenance is server-controlled: uploads can never pose as imported ("hf") questions.
    // sample_index keeps upload order, so "first N" is the same prefix on every run.
    const questionRows: BenchmarkQuestionInsert[] = validQuestions.map((q, i) => ({
      benchmark_id: benchmarkId,
      prompt: q.prompt,
      expected_answer: q.expected_answer,
      metadata: { ...q.metadata, source: "custom", sample_index: i },
    }));

    const { error: qError } = await supabase.from("benchmark_questions").insert(questionRows);

    if (qError) {
      // Roll back the benchmark so no empty suite is left behind.
      await supabase.from("benchmarks").delete().eq("id", benchmarkId);
      // The row existed briefly; drop any cached benchmark list that could have picked it up.
      revalidateBenchmarks();
      return databaseErrorResponse(qError, "Failed to store benchmark questions");
    }

    revalidateBenchmarks();
    const skipped = questions.length - validQuestions.length;
    return NextResponse.json(
      {
        success: true,
        data: benchmark,
        message:
          `Created benchmark "${name.trim()}" with ${validQuestions.length} questions.` +
          (skipped > 0 ? ` Skipped ${skipped} invalid row${skipped === 1 ? "" : "s"}.` : ""),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Custom benchmark creation error:", err);
    if (err instanceof AdminConfigError) return apiError(err.message, "CONFIG_ERROR", 500);
    return apiError(errorMessage(err, "Failed to create custom benchmark."), "INTERNAL_ERROR", 500);
  }
}
