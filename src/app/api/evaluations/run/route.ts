import { NextRequest, NextResponse } from "next/server";
import { runEvaluation } from "@/lib/eval/runner";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { modelId, benchmarkId, limitQuestions } = body;

    if (!modelId || !benchmarkId) {
      return NextResponse.json(
        { error: "modelId and benchmarkId are required." },
        { status: 400 }
      );
    }

    const result = await runEvaluation({
      modelId,
      benchmarkId,
      limitQuestions: limitQuestions ? Number(limitQuestions) : 10,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Evaluation run error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to execute evaluation." },
      { status: 500 }
    );
  }
}
