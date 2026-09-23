/** Data shapes for the landing page showcase, built on the server from completed evaluations. */

/** Live catalog counts fetched by the server page; null when the query failed. */
export interface LandingStats {
  models: number | null;
  benchmarks: number | null;
  /** Mean Wilson 95% half-width (percentage points) across featured evaluations. */
  avgCiHalfWidth: number | null;
}

/** Display grouping for benchmark categories in the arena filter. */
export type ArenaCategory = "Knowledge" | "Code" | "Math" | "Reasoning" | "Chat";

/** One completed evaluation, always carrying its Wilson 95% bounds and a drill-down id. */
export interface ScoreCell {
  evaluationId: string;
  accuracy: number;
  lower: number | null;
  upper: number | null;
  n: number;
}

export interface HeroRow extends ScoreCell {
  name: string;
  lab: string;
  /** Vendor slug used to look up the shared vendor color. */
  vendor: string;
}

/** Top models on one benchmark, built from real completed evaluations. */
export interface HeroBoard {
  benchmark: string;
  rows: HeroRow[];
}

export interface ArenaModel {
  id: string;
  name: string;
  shortName: string;
  lab: string;
  vendor: string;
  badge: string;
}

export interface ArenaBenchmark {
  benchmarkId: string;
  name: string;
  category: ArenaCategory;
  description: string;
  a: ScoreCell;
  b: ScoreCell;
}

/** A pair of real models compared on the benchmarks both have completed. */
export interface ArenaMatchup {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  modelA: ArenaModel;
  modelB: ArenaModel;
  specs: {
    latencyA: number | null;
    latencyB: number | null;
    priceA: number | null;
    priceB: number | null;
    contextA: number | null;
    contextB: number | null;
    throughputA: number | null;
    throughputB: number | null;
  };
  benchmarks: ArenaBenchmark[];
}

export interface LandingShowcase {
  /** `empty`: no completed evaluations yet; `unavailable`: the database could not be reached. */
  status: "ok" | "empty" | "unavailable";
  heroBoards: HeroBoard[];
  matchups: ArenaMatchup[];
}
