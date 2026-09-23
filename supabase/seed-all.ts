/**
 * Full seed entry point (pnpm db:seed:all).
 *
 * Seeding = models + benchmarks + spaces only. Evaluation rows, per-prompt results and
 * benchmark questions are never seeded: questions come from the real Hugging Face import
 * and every score comes from a real run on a free OpenRouter model.
 */
import { NEXT_STEPS_MESSAGE, runCatalogSeed } from "./seed";

async function main(): Promise<void> {
  console.log("🪐 Orbbit seed: models + benchmarks + spaces\n");
  await runCatalogSeed();
  console.log("\n✅ Catalog seeded. No evaluation scores were seeded.");
  console.log(NEXT_STEPS_MESSAGE);
}

main().catch((err: unknown) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
