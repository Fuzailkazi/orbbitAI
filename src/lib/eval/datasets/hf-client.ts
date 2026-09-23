/**
 * Minimal read-only client for the public Hugging Face datasets-server and raw
 * dataset files. Used only by the one-off question importer (never at eval time).
 *
 * Retries: this is a bulk data load, not a model call, so a bounded retry with
 * exponential backoff on 429/5xx is acceptable. Failures after the last attempt
 * surface as a clear error.
 */
import type { DatasetsServerSource, HfRow, RawJsonFileSource } from "./types";

const DATASETS_SERVER = "https://datasets-server.huggingface.co";
const HF_HUB = "https://huggingface.co";
const PAGE_SIZE = 100; // datasets-server /rows maximum
const MAX_ATTEMPTS = 5;
const CONCURRENCY = 2;
// HF rate-limits anonymous datasets-server traffic at the CDN (429, no Retry-After).
// Space request starts out and back off long on 429 so a full import stays under it.
const MIN_REQUEST_INTERVAL_MS = 1_500;
const RATE_LIMIT_BACKOFF_MS = 30_000;
const ERROR_BACKOFF_MS = 1_000;

export interface HfClientOptions {
  token?: string;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  onRetry?: (message: string) => void;
}

export class HfRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "HfRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let nextRequestAt = 0;

/** Reserves the next request slot so starts are at least MIN_REQUEST_INTERVAL_MS apart. */
async function throttle(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextRequestAt);
  nextRequestAt = slot + MIN_REQUEST_INTERVAL_MS;
  if (slot > now) await delay(slot - now);
}

async function fetchJson(url: string, options: HfClientOptions): Promise<unknown> {
  const doFetch = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  for (let attempt = 1; ; attempt++) {
    let response: Response;
    try {
      await throttle();
      response = await doFetch(url, { headers });
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) {
        throw new HfRequestError(`Network error after ${attempt} attempts: ${url}: ${(err as Error).message}`, null);
      }
      options.onRetry?.(`network error (${(err as Error).message}); retry ${attempt}/${MAX_ATTEMPTS - 1}`);
      await delay(ERROR_BACKOFF_MS * 2 ** (attempt - 1));
      continue;
    }

    if (response.ok) return response.json();

    const retryable = response.status === 429 || response.status >= 500;
    const body = (await response.text()).slice(0, 300);
    if (!retryable || attempt >= MAX_ATTEMPTS) {
      const hint =
        response.status === 401 || response.status === 403 || response.status === 404
          ? " (dataset missing, private, or gated - gated sets need HF_TOKEN with accepted terms)"
          : response.status === 429
            ? " (rate limited by Hugging Face - wait a few minutes and re-run)"
            : "";
      throw new HfRequestError(`HTTP ${response.status} for ${url}${hint}: ${body}`, response.status);
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    const base = response.status === 429 ? RATE_LIMIT_BACKOFF_MS : ERROR_BACKOFF_MS;
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : base * 2 ** (attempt - 1);
    options.onRetry?.(`HTTP ${response.status}; retry ${attempt}/${MAX_ATTEMPTS - 1} in ${waitMs}ms`);
    await delay(waitMs);
  }
}

function query(source: DatasetsServerSource, extra: Record<string, string | number> = {}): string {
  const params = new URLSearchParams({ dataset: source.dataset, config: source.config, split: source.split });
  for (const [key, value] of Object.entries(extra)) params.set(key, String(value));
  return params.toString();
}

/** Number of rows in the split, from /size. */
export async function fetchSplitSize(source: DatasetsServerSource, options: HfClientOptions): Promise<number> {
  const params = new URLSearchParams({ dataset: source.dataset, config: source.config });
  const body = await fetchJson(`${DATASETS_SERVER}/size?${params.toString()}`, options);
  const splits = isRecord(body) && isRecord(body.size) && Array.isArray(body.size.splits) ? body.size.splits : [];
  const match = splits.find((s): s is Record<string, unknown> => isRecord(s) && s.split === source.split);
  if (!match || typeof match.num_rows !== "number") {
    throw new HfRequestError(`No size info for ${source.dataset}/${source.config}/${source.split}`, null);
  }
  return match.num_rows;
}

/** Contiguous [offset, offset+length) windows (each within one 100-row page) covering all indices. */
export function planRowWindows(indices: readonly number[]): { offset: number; length: number }[] {
  const byPage = new Map<number, { min: number; max: number }>();
  for (const index of indices) {
    const page = Math.floor(index / PAGE_SIZE);
    const current = byPage.get(page);
    byPage.set(page, current ? { min: Math.min(current.min, index), max: Math.max(current.max, index) } : { min: index, max: index });
  }
  return [...byPage.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, { min, max }]) => ({ offset: min, length: max - min + 1 }));
}

/**
 * Fetches exactly the requested row indices from /rows. Throws if any is missing or
 * truncated. Rows are written into `sink` as they arrive, so a caller can keep
 * (cache) the rows fetched before a failure.
 */
export async function fetchRowsByIndex(
  source: DatasetsServerSource,
  indices: readonly number[],
  options: HfClientOptions,
  sink: Map<number, HfRow> = new Map(),
): Promise<Map<number, HfRow>> {
  const wanted = new Set(indices);
  const rows = sink;
  const windows = planRowWindows(indices);
  let next = 0;

  const worker = async () => {
    while (next < windows.length) {
      const { offset, length } = windows[next++];
      const body = await fetchJson(`${DATASETS_SERVER}/rows?${query(source, { offset, length })}`, options);
      if (!isRecord(body) || !Array.isArray(body.rows)) {
        throw new HfRequestError(`Unexpected /rows response for ${source.dataset} offset ${offset}`, null);
      }
      for (const item of body.rows) {
        if (!isRecord(item) || typeof item.row_idx !== "number" || !isRecord(item.row)) continue;
        if (!wanted.has(item.row_idx)) continue;
        if (Array.isArray(item.truncated_cells) && item.truncated_cells.length > 0) {
          throw new HfRequestError(
            `${source.dataset} row ${item.row_idx} has truncated cells (${item.truncated_cells.join(", ")}); refusing to import partial data`,
            null,
          );
        }
        rows.set(item.row_idx, item.row);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, windows.length) }, worker));

  const missing = indices.filter((i) => !rows.has(i));
  if (missing.length > 0) {
    throw new HfRequestError(`${source.dataset}: ${missing.length} sampled rows not returned (e.g. ${missing.slice(0, 5).join(", ")})`, null);
  }
  return rows;
}

/** Downloads a raw JSON array file from a dataset repo at a pinned revision. */
export async function fetchRawJsonRows(source: RawJsonFileSource, options: HfClientOptions): Promise<HfRow[]> {
  const url = `${HF_HUB}/datasets/${source.dataset}/resolve/${source.revision}/${source.path}`;
  const body = await fetchJson(url, options);
  if (!Array.isArray(body) || !body.every(isRecord)) {
    throw new HfRequestError(`${url} is not a JSON array of objects`, null);
  }
  return body;
}
