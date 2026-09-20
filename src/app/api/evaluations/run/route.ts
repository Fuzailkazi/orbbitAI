import { NextRequest, NextResponse } from "next/server";
import { runEvaluation } from "@/lib/eval/runner";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { modelId, benchmarkId, limitQuestions, stream = true } = body;

    if (!modelId || !benchmarkId) {
      return NextResponse.json(
        { error: "modelId and benchmarkId are required." },
        { status: 400 }
      );
    }

    const questionCount = limitQuestions ? Number(limitQuestions) : 10;

    // Handle Streaming Response (Server-Sent Events)
    if (stream) {
      const encoder = new TextEncoder();
      const customStream = new ReadableStream({
        async start(controller) {
          try {
            await runEvaluation({
              modelId,
              benchmarkId,
              limitQuestions: questionCount,
              onProgress: (event) => {
                const chunk = `data: ${JSON.stringify(event)}\n\n`;
                controller.enqueue(encoder.encode(chunk));
              },
            });
          } catch (err: any) {
            const errChunk = `data: ${JSON.stringify({
              type: "error",
              message: err?.message || "Execution failed",
            })}\n\n`;
            controller.enqueue(encoder.encode(errChunk));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(customStream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming fallback
    const result = await runEvaluation({
      modelId,
      benchmarkId,
      limitQuestions: questionCount,
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
