/**
 * Local on-disk cache of fetched upstream rows, keyed by dataset/config/split and
 * row index. It only saves Hugging Face requests (the datasets-server rate limit
 * is low): a dry run followed by --write re-uses the rows instead of re-fetching.
 * Lives in the OS temp dir, never in the repo; pass --no-cache to bypass.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatasetsServerSource, HfRow } from "./types";

export interface RowCache {
  load(source: DatasetsServerSource): Promise<Map<number, HfRow>>;
  save(source: DatasetsServerSource, rows: Map<number, HfRow>): Promise<void>;
}

export const DEFAULT_ROW_CACHE_DIR = join(tmpdir(), "orbbit-hf-row-cache");

function fileFor(dir: string, source: DatasetsServerSource): string {
  const key = `${source.dataset}__${source.config}__${source.split}`.replace(/[^A-Za-z0-9._-]/g, "_");
  return join(dir, `${key}.json`);
}

export function createFileRowCache(dir: string = DEFAULT_ROW_CACHE_DIR): RowCache {
  return {
    async load(source) {
      try {
        const parsed: unknown = JSON.parse(await readFile(fileFor(dir, source), "utf8"));
        const rows = new Map<number, HfRow>();
        if (typeof parsed !== "object" || parsed === null) return rows;
        for (const [key, value] of Object.entries(parsed)) {
          const index = Number(key);
          if (Number.isInteger(index) && typeof value === "object" && value !== null && !Array.isArray(value)) {
            rows.set(index, value as HfRow);
          }
        }
        return rows;
      } catch {
        // Missing or unreadable cache simply means "fetch everything".
        return new Map();
      }
    },
    async save(source, rows) {
      await mkdir(dir, { recursive: true });
      await writeFile(fileFor(dir, source), JSON.stringify(Object.fromEntries(rows)));
    },
  };
}
