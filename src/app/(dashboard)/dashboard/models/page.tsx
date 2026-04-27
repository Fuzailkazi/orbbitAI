import { createServerClient } from "@/lib/supabase/server";
import type { Model } from "@/types/database";
import { ModelsClient } from "./models-client";

export default async function ModelsPage() {
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

  return <ModelsClient models={(models as Model[]) ?? []} />;
}
