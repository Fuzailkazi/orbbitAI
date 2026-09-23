import type { Metadata } from "next";
import { getActiveModels } from "@/lib/data";
import { ModelsClient } from "./models-client";

export const metadata: Metadata = {
  title: "Models",
  description: "Browse, search and filter every AI model available through OpenRouter.",
};

export default async function ModelsPage() {
  // Cached catalog rows (no description/tags) keep the RSC payload to what the table renders.
  // Query failures throw and surface through the segment's error.tsx boundary (retry + back link).
  const models = await getActiveModels();

  return <ModelsClient models={models} />;
}
