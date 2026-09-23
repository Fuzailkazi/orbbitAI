/**
 * Request pacing for free-tier OpenRouter calls (20 requests/minute per account).
 *
 * The pacer spaces request *starts* at least `intervalMs` apart. A request that implies
 * follow-up requests (an LLM-judge call after the model call) reserves several slots at once,
 * so the long-run rate stays under the target RPM. It never retries anything: it only decides
 * when the next request may start. Concurrent prompts (see ./concurrency.ts) share one pacer, so
 * overlapping calls never raise the start rate.
 */

export interface PacerClock {
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

export const systemClock: PacerClock = {
  now: () => Date.now(),
  sleep: abortableSleep,
};

/** Minimum spacing between request starts for a target requests-per-minute. */
export function intervalForRpm(rpm: number): number {
  if (!Number.isFinite(rpm) || rpm <= 0) throw new Error(`rpm must be a positive number (got ${rpm}).`);
  return Math.ceil(60_000 / rpm);
}

/** How long to wait before a request may start (pure). */
export function pacingDelayMs(nextAllowedAt: number, now: number): number {
  return Math.max(0, nextAllowedAt - now);
}

export class RequestPacer {
  private nextAllowedAt = 0;
  /** Tail of the acquire queue: acquires are served one at a time, in call order. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    readonly intervalMs: number,
    private readonly clock: PacerClock = systemClock
  ) {
    if (!Number.isFinite(intervalMs) || intervalMs < 0) {
      throw new Error(`intervalMs must be a non-negative number (got ${intervalMs}).`);
    }
  }

  /** Delay the next acquire would wait right now. */
  pendingDelayMs(): number {
    return pacingDelayMs(this.nextAllowedAt, this.clock.now());
  }

  /**
   * Waits until a request may start, then reserves `units` request slots. Returns the ms
   * actually waited. An aborted signal ends the wait early without reserving.
   *
   * Safe under concurrency: overlapping callers are queued FIFO, so two waiters can never both
   * wake up and start in the same slot. The wait is re-checked after sleeping, so a `pause()`
   * issued while a caller is waiting (a per-minute 429 from an in-flight request) still holds.
   */
  acquire(units = 1, signal?: AbortSignal): Promise<number> {
    const turn = this.queue.then(() => this.acquireNow(units, signal));
    this.queue = turn.catch(() => undefined);
    return turn;
  }

  private async acquireNow(units: number, signal?: AbortSignal): Promise<number> {
    let waited = 0;
    for (;;) {
      if (signal?.aborted) return waited;
      const wait = this.pendingDelayMs();
      if (wait <= 0) break;
      await this.clock.sleep(wait, signal);
      waited += wait;
    }
    const start = Math.max(this.clock.now(), this.nextAllowedAt);
    this.nextAllowedAt = start + this.intervalMs * Math.max(1, Math.ceil(units));
    return waited;
  }

  /** Pushes the next start out to at least `now + ms` (after a per-minute 429). */
  pause(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) return;
    this.nextAllowedAt = Math.max(this.nextAllowedAt, this.clock.now() + ms);
  }
}
