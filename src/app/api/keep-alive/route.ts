import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";

/**
 * GET /api/keep-alive — daily database ping so the Supabase free tier never pauses the project
 * (it pauses after 7 days without activity, and a paused project has to be restored by hand).
 *
 * Called by Vercel Cron (vercel.json) and, as an independent backup, by the GitHub Actions
 * workflow in .github/workflows/keep-alive.yml. Page visits don't reliably count: catalog reads
 * are cached, so a quiet week can pass without a single query reaching Postgres.
 *
 * Reading the Authorization header keeps this handler dynamic, so it is never prerendered or
 * cached. The query runs as `anon` through RLS (models has a public SELECT policy).
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured.", code: "CONFIG_ERROR" }, { status: 500 });
  }
  if (!isAuthorizedCronRequest(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase configuration is missing.", code: "CONFIG_ERROR" }, { status: 500 });
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const startedAt = Date.now();
  const { error } = await supabase.from("models").select("id").limit(1);
  const latencyMs = Date.now() - startedAt;

  if (error) {
    // 503 makes the cron run show as failed, and the GitHub backup emails the repo owner.
    console.error("Keep-alive database ping failed:", error);
    return NextResponse.json(
      { error: `Database ping failed: ${error.message}`, code: "DATABASE_ERROR" },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, latencyMs, checkedAt: new Date().toISOString() });
}
