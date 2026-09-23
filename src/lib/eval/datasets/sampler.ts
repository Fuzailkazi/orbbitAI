/**
 * Deterministic sampling for benchmark imports.
 *
 * The sample is a seeded Fisher-Yates permutation of [0, total) truncated to n.
 * Because the permutation only depends on (seedKey, total), the first k entries
 * are identical for every n >= k: growing --n extends the sample instead of
 * reshuffling it, and the runner's "first N by sample_index" is a stable prefix.
 */

/** Bump only if the sampling algorithm changes (changes every sample). */
export const SAMPLE_SEED_VERSION = "orbbit-sample-v1";

export function sampleSeedKey(benchmarkName: string): string {
  return `${SAMPLE_SEED_VERSION}:${benchmarkName}`;
}

/** 32-bit FNV-1a hash of a string. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 PRNG: returns a function yielding floats in [0, 1). */
export function createPrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns min(n, total) distinct row indices in [0, total), in sample order
 * (position in the returned array = sample_index).
 */
export function sampleIndices(total: number, n: number, seedKey: string): number[] {
  if (!Number.isInteger(total) || total < 0) throw new Error(`Invalid dataset size: ${total}`);
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid sample size: ${n}`);
  const take = Math.min(n, total);
  const random = createPrng(hashString(seedKey));
  // Sparse partial Fisher-Yates: only swapped positions are stored, so sampling
  // 200 of 100k rows does not allocate a 100k array.
  const swapped = new Map<number, number>();
  const valueAt = (i: number) => swapped.get(i) ?? i;
  const out: number[] = [];
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(random() * (total - i));
    const vi = valueAt(i);
    const vj = valueAt(j);
    swapped.set(j, vi);
    swapped.set(i, vj);
    out.push(vj);
  }
  return out;
}

/** Deterministic permutation of [0, length) (used only where upstream order leaks the answer). */
export function seededPermutation(length: number, seedKey: string): number[] {
  return sampleIndices(length, length, seedKey);
}
