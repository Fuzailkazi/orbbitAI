import { createClient } from "@supabase/supabase-js";
import { OpenRouterClient } from "../openrouter/client";
import { getScorer } from "./scorers/factory";
import {
  calculateWilsonConfidenceInterval,
  calculatePercentile,
  calculateTokensPerSecond,
} from "./statistics";
import type { Model, Benchmark, BenchmarkQuestion } from "@/types/database";

export type EvaluationProgressEvent =
  | {
      type: "init";
      evaluationId: string;
      modelName: string;
      benchmarkName: string;
      totalQuestions: number;
    }
  | {
      type: "question_start";
      index: number;
      total: number;
      promptSnippet: string;
    }
  | {
      type: "question_complete";
      index: number;
      total: number;
      isCorrect: boolean;
      score: number;
      latencyMs: number;
      tokens: number;
      modelResponseSnippet: string;
      costUsd: number;
    }
  | {
      type: "eval_complete";
      output: EvaluationRunOutput;
    }
  | {
      type: "error";
      message: string;
    };

export interface EvaluationRunnerOptions {
  modelId: string;
  benchmarkId: string;
  limitQuestions?: number;
  onProgress?: (event: EvaluationProgressEvent) => void | Promise<void>;
}

export interface EvaluationRunOutput {
  evaluationId: string;
  status: "completed" | "failed";
  accuracy: number;
  ciLower: number;
  ciUpper: number;
  avgLatencyMs: number;
  medianLatencyMs: number;
  p95LatencyMs: number;
  totalTokens: number;
  totalCost: number;
  tokensPerSecond: number;
  questionsEvaluated: number;
  questionsCorrect: number;
}

export async function runEvaluation({
  modelId,
  benchmarkId,
  limitQuestions = 25,
  onProgress,
}: EvaluationRunnerOptions): Promise<EvaluationRunOutput> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase credentials missing for evaluation runner.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 1. Fetch Model and Benchmark
  const { data: model, error: modelErr } = await supabase
    .from("models")
    .select("*")
    .eq("id", modelId)
    .single();

  if (modelErr || !model) {
    throw new Error(`Model not found: ${modelErr?.message || modelId}`);
  }

  const { data: benchmark, error: benchErr } = await supabase
    .from("benchmarks")
    .select("*")
    .eq("id", benchmarkId)
    .single();

  if (benchErr || !benchmark) {
    throw new Error(`Benchmark not found: ${benchErr?.message || benchmarkId}`);
  }

  // 2. Fetch Questions
  let questionQuery = supabase
    .from("benchmark_questions")
    .select("*")
    .eq("benchmark_id", benchmarkId)
    .order("created_at", { ascending: true });

  if (limitQuestions > 0) {
    questionQuery = questionQuery.limit(limitQuestions);
  }

  const { data: questions, error: qErr } = await questionQuery;

  if (qErr || !questions || questions.length === 0) {
    throw new Error(`No benchmark questions found for benchmark ${benchmark.name}.`);
  }

  // 3. Create Evaluation Run Record (Status: running)
  const { data: evalRecord, error: evalInitErr } = await supabase
    .from("evaluations")
    .insert({
      model_id: modelId,
      benchmark_id: benchmarkId,
      status: "running",
      questions_evaluated: 0,
      questions_correct: 0,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (evalInitErr || !evalRecord) {
    throw new Error(`Failed to initialize evaluation record: ${evalInitErr?.message}`);
  }

  const evaluationId = evalRecord.id;

  // Emit initialization event
  await onProgress?.({
    type: "init",
    evaluationId,
    modelName: model.name,
    benchmarkName: benchmark.name,
    totalQuestions: questions.length,
  });

  // 4. Initialize Client & Scorer
  const openRouter = new OpenRouterClient();
  const scorer = getScorer(benchmark.scoring_method);
  const pricing = { input: model.pricing_input, output: model.pricing_output };

  const results: any[] = [];
  const latencies: number[] = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCostUsd = 0;
  let correctCount = 0;
  let failedRequests = 0;

  // 5. Execute Questions Sequentially (with small delay to prevent rate-limits)
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i] as BenchmarkQuestion;

    await onProgress?.({
      type: "question_start",
      index: i + 1,
      total: questions.length,
      promptSnippet: q.prompt.slice(0, 100).replace(/\n/g, " "),
    });

    try {
      const response = await openRouter.createChatCompletion(
        {
          model: model.api_identifier,
          messages: [
            {
              role: "system",
              content:
                "You are an expert AI model taking a standardized benchmark test. Answer accurately, concisely, and directly according to instructions.",
            },
            {
              role: "user",
              content: q.prompt,
            },
          ],
          temperature: 0,
          max_tokens: 512,
        },
        pricing
      );

      const scoreResult = await scorer.score(response.text, q.expected_answer, q.metadata);

      if (scoreResult.isCorrect) {
        correctCount++;
      }

      latencies.push(response.latencyMs);
      totalPromptTokens += response.promptTokens;
      totalCompletionTokens += response.completionTokens;
      totalCostUsd += response.costUsd;

      results.push({
        evaluation_id: evaluationId,
        question_id: q.id,
        model_response: response.text,
        is_correct: scoreResult.isCorrect,
        score: scoreResult.score,
        latency_ms: response.latencyMs,
        tokens_used: response.totalTokens,
        time_to_first_token_ms: response.timeToFirstTokenMs,
        judge_reasoning: scoreResult.reasoning,
      });

      await onProgress?.({
        type: "question_complete",
        index: i + 1,
        total: questions.length,
        isCorrect: scoreResult.isCorrect,
        score: scoreResult.score,
        latencyMs: response.latencyMs,
        tokens: response.totalTokens,
        modelResponseSnippet: response.text.slice(0, 80).replace(/\n/g, " "),
        costUsd: response.costUsd,
      });

      // Small delay between questions
      if (i < questions.length - 1) {
        await new Promise((res) => setTimeout(res, 200));
      }
    } catch (callErr: any) {
      failedRequests++;
      results.push({
        evaluation_id: evaluationId,
        question_id: q.id,
        model_response: `[Error: ${callErr?.message || "Execution failed"}]`,
        is_correct: false,
        score: 0.0,
        latency_ms: 0,
        tokens_used: 0,
        time_to_first_token_ms: null,
        judge_reasoning: `Model API call failed: ${callErr?.message}`,
      });

      await onProgress?.({
        type: "question_complete",
        index: i + 1,
        total: questions.length,
        isCorrect: false,
        score: 0.0,
        latencyMs: 0,
        tokens: 0,
        modelResponseSnippet: `[Failed: ${callErr?.message || "Error"}]`,
        costUsd: 0,
      });
    }
  }

  // 6. Insert All Results
  if (results.length > 0) {
    const { error: batchInsertErr } = await supabase
      .from("evaluation_results")
      .insert(results);

    if (batchInsertErr) {
      console.error("Warning: Failed to save evaluation_results batch:", batchInsertErr.message);
    }
  }

  // 7. Compute Aggregate Statistics
  const evaluatedCount = questions.length;
  const accuracy = evaluatedCount > 0 ? (correctCount / evaluatedCount) * 100 : 0;
  const ci = calculateWilsonConfidenceInterval(correctCount, evaluatedCount);
  const avgLatency =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;
  const medianLatency = calculatePercentile(latencies, 50);
  const p95Latency = calculatePercentile(latencies, 95);
  const totalTokens = totalPromptTokens + totalCompletionTokens;
  const totalLatencySum = latencies.reduce((a, b) => a + b, 0);
  const tokensPerSecond = calculateTokensPerSecond(totalCompletionTokens, totalLatencySum);
  const failureRate = evaluatedCount > 0 ? (failedRequests / evaluatedCount) * 100 : 0;

  // 8. Update Evaluation Record with Final Metrics
  await supabase
    .from("evaluations")
    .update({
      status: "completed",
      accuracy: Math.round(accuracy * 10) / 10,
      accuracy_ci_lower: ci.lower,
      accuracy_ci_upper: ci.upper,
      avg_latency_ms: avgLatency,
      median_latency_ms: medianLatency,
      p95_latency_ms: p95Latency,
      total_tokens: totalTokens,
      total_cost: totalCostUsd,
      failure_rate: failureRate,
      tokens_per_second: tokensPerSecond,
      questions_evaluated: evaluatedCount,
      questions_correct: correctCount,
      completed_at: new Date().toISOString(),
    })
    .eq("id", evaluationId);

  const finalOutput: EvaluationRunOutput = {
    evaluationId,
    status: "completed",
    accuracy: Math.round(accuracy * 10) / 10,
    ciLower: ci.lower,
    ciUpper: ci.upper,
    avgLatencyMs: avgLatency,
    medianLatencyMs: medianLatency,
    p95LatencyMs: p95Latency,
    totalTokens,
    totalCost: totalCostUsd,
    tokensPerSecond,
    questionsEvaluated: evaluatedCount,
    questionsCorrect: correctCount,
  };

  await onProgress?.({
    type: "eval_complete",
    output: finalOutput,
  });

  return finalOutput;
}
