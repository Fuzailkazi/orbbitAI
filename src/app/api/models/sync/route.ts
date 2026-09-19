import { NextRequest, NextResponse } from "next/server";
import { syncOpenRouterModels } from "@/lib/openrouter/sync";

export async function POST(req: NextRequest) {
  try {
    const result = await syncOpenRouterModels();
    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error("Model sync error:", err);
    return NextResponse.json({ error: err?.message || "Sync failed" }, { status: 500 });
  }
}
