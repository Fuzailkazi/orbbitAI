import test from "node:test";
import assert from "node:assert/strict";
import { RequestPacer, type PacerClock } from "../../src/lib/eval/batch/pacing";
import { clampConcurrency, runPacedPool, type PoolDecision } from "../../src/lib/eval/batch/concurrency";
import { parseBatchArgs, BatchArgsError } from "../../src/lib/eval/batch/args";
import { EVAL_DEFAULT_CONCURRENCY, EVAL_MAX_CONCURRENCY } from "../../src/lib/eval/limits";

// ---------- deterministic virtual clock ----------

interface VirtualTimer {
  at: number;
  seq: number;
  fire: () => void;
}

/**
 * Virtual time: `sleep` registers a timer; `run(promise)` advances time to the next timer only
 * once every microtask has settled, so tests are exact and instant (no real waiting).
 */
class VirtualClock implements PacerClock {
  t = 0;
  private seq = 0;
  private timers: VirtualTimer[] = [];

  now = (): number => this.t;

  sleep = (ms: number, signal?: AbortSignal): Promise<void> => {
    if (ms <= 0 || signal?.aborted) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timer: VirtualTimer = {
        at: this.t + ms,
        seq: this.seq++,
        fire: () => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        },
      };
      const onAbort = () => {
        this.timers = this.timers.filter((x) => x !== timer);
        resolve();
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      this.timers.push(timer);
    });
  };

  private async settle(): Promise<void> {
    for (let i = 0; i < 3; i++) await new Promise<void>((r) => setImmediate(r));
  }

  async run<T>(work: Promise<T>): Promise<T> {
    let done = false;
    work.then(
      () => (done = true),
      () => (done = true)
    );
    await this.settle();
    while (!done) {
      if (this.timers.length === 0) throw new Error("Deadlock: work is pending but no timer is scheduled.");
      this.timers.sort((a, b) => a.at - b.at || a.seq - b.seq);
      const next = this.timers.shift()!;
      this.t = Math.max(this.t, next.at);
      next.fire();
      await this.settle();
    }
    return work;
  }
}

interface Trace {
  starts: number[];
  startedIndices: number[];
  completions: { index: number; at: number }[];
  maxInFlight: number;
}

/** A paced pool whose items "take" durations[i] of virtual time. */
function pacedRun(
  clock: VirtualClock,
  opts: {
    durations: number[];
    concurrency: number;
    intervalMs: number;
    onDone?: (index: number, pacer: RequestPacer) => PoolDecision | Promise<PoolDecision>;
    gate?: (index: number) => PoolDecision;
  }
) {
  const pacer = new RequestPacer(opts.intervalMs, clock);
  const trace: Trace = { starts: [], startedIndices: [], completions: [], maxInFlight: 0 };
  let inFlight = 0;
  const promise = runPacedPool({
    items: opts.durations,
    concurrency: opts.concurrency,
    beforeStart: async (_d, index, signal) => {
      await pacer.acquire(1, signal);
      if (signal.aborted) return "stop";
      return opts.gate?.(index) ?? "continue";
    },
    run: async (duration, index) => {
      trace.starts.push(clock.t);
      trace.startedIndices.push(index);
      inFlight++;
      trace.maxInFlight = Math.max(trace.maxInFlight, inFlight);
      await clock.sleep(duration);
      inFlight--;
      trace.completions.push({ index, at: clock.t });
      return (await opts.onDone?.(index, pacer)) ?? "continue";
    },
  });
  return { promise, trace, pacer };
}

// ---------- scheduler ----------

test("runPacedPool: keeps up to N prompts in flight while starts stay paced", async () => {
  const clock = new VirtualClock();
  const { promise, trace } = pacedRun(clock, { durations: [5000, 5000, 5000, 5000, 5000, 5000], concurrency: 3, intervalMs: 1000 });
  const result = await clock.run(promise);
  assert.deepEqual(result, { started: 6, stopped: false });
  // Three paced starts, then each new start waits for a free slot (and the pacer).
  assert.deepEqual(trace.starts, [0, 1000, 2000, 5000, 6000, 7000]);
  assert.equal(trace.maxInFlight, 3);
  assert.equal(clock.t, 12_000); // vs 30 000 sequentially
});

test("runPacedPool: concurrency 1 is strictly sequential (previous behaviour)", async () => {
  const clock = new VirtualClock();
  const { promise, trace } = pacedRun(clock, { durations: [5000, 5000, 5000], concurrency: 1, intervalMs: 1000 });
  await clock.run(promise);
  assert.deepEqual(trace.starts, [0, 5000, 10_000]);
  assert.equal(trace.maxInFlight, 1);
  assert.equal(clock.t, 15_000);
});

test("runPacedPool: starts are never closer than the pacer interval, even for instant calls", async () => {
  const clock = new VirtualClock();
  const { promise, trace } = pacedRun(clock, { durations: [0, 0, 0, 0, 0], concurrency: 5, intervalMs: 3334 });
  await clock.run(promise);
  assert.deepEqual(trace.starts, [0, 3334, 6668, 10_002, 13_336]);
  for (let i = 1; i < trace.starts.length; i++) assert.ok(trace.starts[i] - trace.starts[i - 1] >= 3334);
});

test("runPacedPool: starts in question order, completes out of order, reports every prompt", async () => {
  const clock = new VirtualClock();
  const { promise, trace } = pacedRun(clock, { durations: [5000, 1000, 1000], concurrency: 3, intervalMs: 100 });
  await clock.run(promise);
  assert.deepEqual(trace.startedIndices, [0, 1, 2]);
  assert.deepEqual(
    trace.completions.map((c) => c.index),
    [1, 2, 0]
  );
});

test("runPacedPool: a stop (e.g. daily quota) cancels pending starts, wakes the paced wait, lets in-flight prompts finish", async () => {
  const clock = new VirtualClock();
  const { promise, trace } = pacedRun(clock, {
    durations: [10_000, 500, 5000, 5000],
    concurrency: 3,
    intervalMs: 1000,
    onDone: (index, pacer) => {
      if (index !== 1) return "continue";
      pacer.pause(60_000); // would hold the next start for a minute...
      return "stop"; // ...but the stop wakes it immediately
    },
  });
  const result = await clock.run(promise);
  assert.deepEqual(result, { started: 2, stopped: true });
  assert.deepEqual(trace.startedIndices, [0, 1]); // prompt 2 was waiting for its slot at 1500 ms
  assert.deepEqual(
    trace.completions.map((c) => c.index),
    [1, 0]
  ); // in-flight prompt 0 still finished and was recorded
  assert.equal(clock.t, 10_000); // not 61 500: nothing waited out the pause
});

test("runPacedPool: the gate can stop (deadline) — nothing more starts, in-flight prompts finish", async () => {
  const clock = new VirtualClock();
  const { promise, trace } = pacedRun(clock, {
    durations: [3000, 3000, 3000, 3000],
    concurrency: 3,
    intervalMs: 1000,
    gate: () => (clock.t >= 2000 ? "stop" : "continue"),
  });
  const result = await clock.run(promise);
  assert.deepEqual(result, { started: 2, stopped: true });
  assert.deepEqual(
    trace.completions.map((c) => c.index),
    [0, 1]
  );
  assert.equal(clock.t, 4000);
});

test("runPacedPool: a failing prompt stops new starts, drains in-flight work, then rethrows once", async () => {
  const clock = new VirtualClock();
  const boom = new Error("Failed to save per-prompt result");
  const { promise, trace } = pacedRun(clock, {
    durations: [5000, 500, 5000, 5000],
    concurrency: 3,
    intervalMs: 1000,
    onDone: (index) => {
      if (index === 1) throw boom;
      return "continue";
    },
  });
  await assert.rejects(clock.run(promise), (err) => err === boom);
  assert.deepEqual(trace.startedIndices, [0, 1]);
  assert.deepEqual(
    trace.completions.map((c) => c.index),
    [1, 0]
  );
  assert.equal(clock.t, 5000); // rejected only after prompt 0 settled
});

test("runPacedPool: empty input and invalid concurrency", async () => {
  assert.deepEqual(
    await runPacedPool({ items: [], concurrency: 3, beforeStart: async () => "continue", run: async () => "continue" }),
    { started: 0, stopped: false }
  );
  const seen: number[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  await runPacedPool({
    items: [1, 2, 3],
    concurrency: 0, // clamped to 1
    beforeStart: async () => "continue",
    run: async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise<void>((r) => setImmediate(r));
      seen.push(n);
      inFlight--;
      return "continue";
    },
  });
  assert.deepEqual(seen, [1, 2, 3]);
  assert.equal(maxInFlight, 1);
});

test("clampConcurrency: default, floor, bounds", () => {
  assert.equal(clampConcurrency(undefined, 3, 5), 3);
  assert.equal(clampConcurrency(Number.NaN, 3, 5), 3);
  assert.equal(clampConcurrency(0, 3, 5), 1);
  assert.equal(clampConcurrency(2.9, 3, 5), 2);
  assert.equal(clampConcurrency(50, 3, 5), 5);
});

// ---------- pacer under concurrency ----------

test("RequestPacer: overlapping acquires are served FIFO, one slot each", async () => {
  const clock = new VirtualClock();
  const pacer = new RequestPacer(1000, clock);
  const startedAt: number[] = [];
  const all = Promise.all(
    [0, 1, 2].map(async () => {
      await pacer.acquire();
      startedAt.push(clock.t);
    })
  );
  await clock.run(all);
  assert.deepEqual(startedAt, [0, 1000, 2000]);
});

test("RequestPacer: a pause issued while a caller is waiting still holds", async () => {
  const clock = new VirtualClock();
  const pacer = new RequestPacer(1000, clock);
  await pacer.acquire(); // slot at 0
  let startedAt = -1;
  const waiter = pacer.acquire().then(() => {
    startedAt = clock.t;
  });
  const pauser = clock.sleep(500).then(() => pacer.pause(5000)); // a 429 lands at 500 ms
  await clock.run(Promise.all([waiter, pauser]));
  assert.equal(startedAt, 5500);
});

test("RequestPacer: an aborted waiter does not block the queue or reserve a slot", async () => {
  const clock = new VirtualClock();
  const pacer = new RequestPacer(1000, clock);
  await pacer.acquire(); // slot at 0; next allowed at 1000
  const ctrl = new AbortController();
  const aborted = pacer.acquire(1, ctrl.signal);
  let secondAt = -1;
  const second = pacer.acquire().then(() => {
    secondAt = clock.t;
  });
  const aborter = clock.sleep(200).then(() => ctrl.abort());
  await clock.run(Promise.all([aborted, second, aborter]));
  assert.equal(secondAt, 1000); // took the slot the aborted waiter never reserved
});

// ---------- CLI flag ----------

test("parseBatchArgs: --concurrency default and bounds", () => {
  assert.equal(parseBatchArgs([])?.concurrency, EVAL_DEFAULT_CONCURRENCY);
  assert.equal(parseBatchArgs(["--concurrency", "1"])?.concurrency, 1);
  assert.equal(parseBatchArgs([`--concurrency=${EVAL_MAX_CONCURRENCY}`])?.concurrency, EVAL_MAX_CONCURRENCY);
  assert.throws(() => parseBatchArgs(["--concurrency", "0"]), BatchArgsError);
  assert.throws(() => parseBatchArgs(["--concurrency", String(EVAL_MAX_CONCURRENCY + 1)]), BatchArgsError);
});
