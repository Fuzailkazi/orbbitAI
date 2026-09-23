import { Worker } from "node:worker_threads";
import { ASSERT_SHIM_SOURCE } from "./assert-shim";
import { SANDBOX_WORKER_SOURCE } from "./worker-source";

/**
 * Executes candidate JavaScript against a test harness (MultiPL-E style) in isolation.
 *
 * SECURITY NOTE — isolation by convention, NOT a hardened security boundary.
 * The code runs in a node:vm context inside a dedicated worker thread with resource limits,
 * an empty environment, no module access and a wall-clock kill switch. That stops accidental
 * damage and casual misuse by model-generated code (file/network/process access, runaway loops,
 * memory blow-ups), but node:vm is documented as not being a security mechanism: a determined
 * attacker who finds a V8/vm escape would be running inside this server process. Do not use it
 * for untrusted input beyond benchmark evaluation of model outputs; move to a separate process /
 * container (or a dedicated sandbox service) if the threat model changes.
 */

export type SandboxStatus =
  /** Tests ran to completion without throwing. */
  | "passed"
  /** Candidate or tests threw (syntax error, failed assertion, runtime error, memory limit). */
  | "failed"
  /** Wall-clock or vm timeout (e.g. an infinite loop). */
  | "timeout"
  /** The sandbox itself could not run — an infrastructure problem, not a verdict on the code. */
  | "error";

export type SandboxPhase = "setup" | "candidate" | "tests";

export interface SandboxResult {
  status: SandboxStatus;
  phase?: SandboxPhase;
  errorName?: string;
  message?: string;
  durationMs: number;
}

export interface SandboxOptions {
  /** Wall-clock budget for the whole run, in ms (default 5000). */
  timeoutMs?: number;
  /** V8 old-generation heap cap for the worker, in MB (default 64). */
  maxOldGenerationSizeMb?: number;
}

export const DEFAULT_SANDBOX_TIMEOUT_MS = 5_000;
const DEFAULT_OLD_GEN_MB = 64;
/** Refuse absurdly large inputs outright rather than parsing them. */
const MAX_SOURCE_CHARS = 200_000;

interface WorkerMessage {
  status: SandboxStatus;
  phase?: SandboxPhase;
  errorName?: string;
  message?: string;
}

function isWorkerMessage(value: unknown): value is WorkerMessage {
  if (typeof value !== "object" || value === null) return false;
  const status = (value as { status?: unknown }).status;
  return status === "passed" || status === "failed" || status === "timeout" || status === "error";
}

function toPhase(value: unknown): SandboxPhase | undefined {
  return value === "setup" || value === "candidate" || value === "tests" ? value : undefined;
}

/** Runs `code` followed by `tests` in the sandbox. Never throws; infrastructure problems return status "error". */
export async function runJavaScriptTests(
  code: string,
  tests: string,
  options: SandboxOptions = {}
): Promise<SandboxResult> {
  const timeoutMs =
    options.timeoutMs !== undefined && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? Math.round(options.timeoutMs)
      : DEFAULT_SANDBOX_TIMEOUT_MS;
  const startedAt = Date.now();
  const elapsed = (): number => Date.now() - startedAt;

  if (code.length + tests.length > MAX_SOURCE_CHARS) {
    return {
      status: "failed",
      phase: "candidate",
      errorName: "RangeError",
      message: `Source exceeds ${MAX_SOURCE_CHARS} characters.`,
      durationMs: 0,
    };
  }

  let worker: Worker;
  try {
    worker = new Worker(SANDBOX_WORKER_SOURCE, {
      eval: true,
      workerData: { code, tests, prelude: ASSERT_SHIM_SOURCE, timeoutMs },
      env: {},
      argv: [],
      execArgv: [],
      resourceLimits: {
        maxOldGenerationSizeMb: options.maxOldGenerationSizeMb ?? DEFAULT_OLD_GEN_MB,
        maxYoungGenerationSizeMb: 16,
        codeRangeSizeMb: 16,
        stackSizeMb: 4,
      },
    });
  } catch (err) {
    return {
      status: "error",
      phase: "setup",
      errorName: err instanceof Error ? err.name : "Error",
      message: `Could not start sandbox worker: ${err instanceof Error ? err.message : String(err)}`,
      durationMs: elapsed(),
    };
  }

  return new Promise<SandboxResult>((resolve) => {
    let done = false;
    const settle = (result: Omit<SandboxResult, "durationMs">): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ...result, durationMs: elapsed() });
      void worker.terminate().catch(() => undefined);
    };

    const timer = setTimeout(() => {
      settle({
        status: "timeout",
        errorName: "TimeoutError",
        message: `Execution exceeded the ${timeoutMs}ms wall-clock limit.`,
      });
    }, timeoutMs);

    worker.once("message", (msg: unknown) => {
      if (!isWorkerMessage(msg)) {
        settle({ status: "error", phase: "setup", message: "Sandbox returned a malformed result." });
        return;
      }
      settle({
        status: msg.status,
        phase: toPhase(msg.phase),
        errorName: typeof msg.errorName === "string" ? msg.errorName : undefined,
        message: typeof msg.message === "string" ? msg.message : undefined,
      });
    });

    worker.once("error", (err: Error & { code?: string }) => {
      if (err.code === "ERR_WORKER_OUT_OF_MEMORY") {
        settle({ status: "failed", phase: "tests", errorName: "RangeError", message: "Memory limit exceeded." });
        return;
      }
      settle({ status: "error", phase: "setup", errorName: err.name, message: `Sandbox worker crashed: ${err.message}` });
    });

    worker.once("exit", (exitCode: number) => {
      settle({ status: "error", phase: "setup", message: `Sandbox worker exited unexpectedly (code ${exitCode}).` });
    });
  });
}
