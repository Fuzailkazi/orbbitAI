import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, icon, benchmarkIds } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Space name is required." }, { status: 400 });
    }

    if (!benchmarkIds || !Array.isArray(benchmarkIds) || benchmarkIds.length === 0) {
      return NextResponse.json({ error: "Please select at least one benchmark." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: space, error: spaceError } = await supabase
      .from("spaces")
      .insert({
        name: name.trim(),
        description: (description || "").trim(),
        icon: icon || "layout-grid",
        benchmark_ids: benchmarkIds,
      })
      .select()
      .single();

    if (spaceError) {
      return NextResponse.json({ error: spaceError.message }, { status: 400 });
    }

    // Insert into space_benchmarks junction
    const junctionRows = benchmarkIds.map((bId) => ({
      space_id: space.id,
      benchmark_id: bId,
    }));

    await supabase.from("space_benchmarks").insert(junctionRows);

    return NextResponse.json({ success: true, data: space });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Space ID is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from("spaces").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
