import { createServerClient } from "@/lib/supabase/server";
import type { Model } from "@/types/database";
import { CompareClient } from "./compare-client";

export default async function ComparePage() {
  const supabase = await createServerClient();

  const { data: models, error } = await supabase
    .from("models")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-red-500">Failed to load models: {error.message}</p>
      </div>
    );
  }

  return <CompareClient models={(models as Model[]) ?? []} />;
}
