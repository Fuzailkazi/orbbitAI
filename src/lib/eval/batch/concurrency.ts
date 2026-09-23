/**
 * Bounded-concurrency scheduler for evaluation prompts (pure: no timers, no I/O of its own).
 *
 * Free-tier OpenRouter calls take 5–30 s while the pacer allows a request START only every
 * ~3.3 s, so a strictly sequential run spends almost all of its wall-clock time waiting on one
 * call. This pool keeps up to `concurrency` prompts in flight while starts stay serialized:
 *
 * - `beforeStart` runs one item at a time, in item order, and only once a slot is free. The
 *   caller waits on its pacer there, so the request RATE is exactly what the pacer allows;
 *   concurrency only overlaps slow calls, it never adds requests per minute.
 * - `run` executes concurrently and may finish out of order.
 * - Either callback can return "stop": nothing further is started, a `beforeStart` that is
 *   waiting is woken through `signal`, and in-flight items are left to finish (or abort through
 *   the caller's own signal). The pool resolves only when every started item has settled.
 * - If a `run` throws, nothing further is started, the rest drain, then the first error is
 *   rethrown — so a caller's finalization still runs exactly once, after all work is done.
 */

export type PoolDecision = "continue" | "stop";

export interface PacedPoolOptions<T> {
  items: readonly T[];
  /** Maximum items in flight at once (clamped to >= 1). */
  concurrency: number;
  /**
   * Gate before each start: serialized, in item order, called only when a slot is free.
   * `signal` aborts as soon as the pool stops (pass it to any wait). Return "stop" to start
   * nothing more.
   */
  beforeStart: (item: T, index: number, signal: AbortSignal) => Promise<PoolDecision>;
  /** The work for one item. "stop" means no further item is started; in-flight items finish. */
  run: (item: T, index: number) => Promise<PoolDecision>;
}

export interface PacedPoolResult {
  /** Items whose `run` was started. */
  started: number;
  /** True when a callback returned "stop" (or a run threw) before every item was started. */
  stopped: boolean;
}

/** Clamps a requested concurrency to a positive integer no larger than `max`. */
export function clampConcurrency(requested: number | undefined, fallback: number, max: number): number {
  const value = requested === undefined || !Number.isFinite(requested) ? fallback : Math.floor(requested);
  return Math.max(1, Math.min(max, value));
}

export async function runPacedPool<T>({ items, concurrency, beforeStart, run }: PacedPoolOptions<T>): Promise<PacedPoolResult> {
  const limit = Math.max(1, Math.floor(Number.isFinite(concurrency) ? concurrency : 1));
  const stopController = new AbortController();
  const inFlight = new Set<Promise<void>>();
  let failure: { error: unknown } | null = null;
  let next = 0;

  const stop = () => {
    if (!stopController.signal.aborted) stopController.abort();
  };

  while (next < items.length && !stopController.signal.aborted) {
    if (inFlight.size >= limit) {
      // Tracked promises never reject (errors are captured below).
      await Promise.race(inFlight);
      continue;
    }

    const index = next;
    const item = items[index];
    let decision: PoolDecision;
    try {
      decision = await beforeStart(item, index, stopController.signal);
    } catch (err) {
      failure ??= { error: err };
      stop();
      break;
    }
    // A running item may have stopped the pool while the gate was waiting.
    if (decision === "stop" || stopController.signal.aborted) {
      stop();
      break;
    }

    next++;
    const tracked: Promise<void> = (async () => {
      try {
        if ((await run(item, index)) === "stop") stop();
      } catch (err) {
        failure ??= { error: err };
        stop();
      }
    })().finally(() => {
      inFlight.delete(tracked);
    });
    inFlight.add(tracked);
  }

  await Promise.all(inFlight);
  if (failure) throw failure.error;
  return { started: next, stopped: stopController.signal.aborted && next < items.length };
}
