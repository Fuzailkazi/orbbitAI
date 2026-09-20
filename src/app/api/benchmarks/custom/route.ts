import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, scoringMethod = "exact_match", questions } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Benchmark name is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "At least one question is required." },
        { status: 400 }
      );
    }

    // Sanitize questions
    const validQuestions = questions
      .filter((q) => q && typeof q.prompt === "string" && typeof q.expected_answer === "string")
      .map((q) => ({
        prompt: q.prompt.trim(),
        expected_answer: q.expected_answer.trim(),
        metadata: q.metadata || {},
      }));

    if (validQuestions.length === 0) {
      return NextResponse.json(
        { error: "No valid questions found. Each question must have 'prompt' and 'expected_answer'." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Database configuration missing." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Create Benchmark Record
    const benchmarkName = name.trim();
    const { data: benchmark, error: bError } = await supabase
      .from("benchmarks")
      .insert({
        name: benchmarkName,
        description: description?.trim() || "Custom user-uploaded benchmark suite",
        category: "general",
        scoring_method: scoringMethod,
        total_questions: validQuestions.length,
        source_url: "custom-upload",
      })
      .select("id, name, category, scoring_method, total_questions")
      .single();

    if (bError || !benchmark) {
      return NextResponse.json(
        { error: `Failed to create benchmark: ${bError?.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    // 2. Insert Questions
    const questionRows = validQuestions.map((q) => ({
      benchmark_id: benchmark.id,
      prompt: q.prompt,
      expected_answer: q.expected_answer,
      metadata: q.metadata,
    }));

    const { error: qError } = await supabase
      .from("benchmark_questions")
      .insert(questionRows);

    if (qError) {
      // Rollback benchmark if questions fail
      await supabase.from("benchmarks").delete().eq("id", benchmark.id);
      return NextResponse.json(
        { error: `Failed to store benchmark questions: ${qError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: benchmark,
      message: `Created benchmark "${benchmark.name}" with ${validQuestions.length} questions.`,
    });
  } catch (error: any) {
    console.error("Custom benchmark creation error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create custom benchmark." },
      { status: 500 }
    );
  }
}
