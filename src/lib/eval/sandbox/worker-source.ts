/**
 * Source of the sandbox worker, started with `new Worker(SANDBOX_WORKER_SOURCE, { eval: true })`.
 *
 * Keeping the worker as an inline CommonJS string means there is no separate worker file to
 * resolve or bundle: it runs identically under tsx (scripts, tests) and inside Next.js route
 * handlers built by Turbopack.
 *
 * Inside the worker the candidate code and the tests run in a FRESH vm context:
 *   - created from a null-prototype object, so no host-realm object is reachable from it;
 *   - with string code generation (eval / new Function) and WebAssembly disabled;
 *   - with `microtaskMode: "afterEvaluate"` so promise jobs count against the vm timeout;
 *   - with no process, require (beyond the assert stub), import, fetch, timers or Buffer.
 * The tests are wrapped in a block so their top-level `const assert = …` cannot collide with a
 * declaration in the candidate code; candidate declarations remain visible to them.
 *
 * Protocol: workerData = { code, tests, prelude, timeoutMs }. The worker posts exactly one
 * message: { status: "passed" } or { status: "failed", phase, errorName, message }.
 */
export const SANDBOX_WORKER_SOURCE = String.raw`
"use strict";
const { parentPort, workerData } = require("node:worker_threads");
const vm = require("node:vm");

let settled = false;
function finish(result) {
  if (settled) return;
  settled = true;
  parentPort.postMessage(result);
}

function describe(err) {
  try {
    if (err !== null && (typeof err === "object" || typeof err === "function")) {
      const name = typeof err.name === "string" ? err.name : "Error";
      const message = typeof err.message === "string" ? err.message : "";
      return { errorName: String(name).slice(0, 100), message: String(message).slice(0, 1000) };
    }
    return { errorName: "Thrown", message: String(err).slice(0, 1000) };
  } catch (e) {
    return { errorName: "Error", message: "Unprintable error." };
  }
}

process.on("unhandledRejection", (reason) => {
  finish(Object.assign({ status: "failed", phase: "tests" }, describe(reason)));
});

const { code, tests, prelude, timeoutMs } = workerData;
let phase = "setup";
try {
  const context = vm.createContext(Object.create(null), {
    name: "orbbit-sandbox",
    codeGeneration: { strings: false, wasm: false },
    microtaskMode: "afterEvaluate",
  });
  const options = (filename) => ({ filename, timeout: timeoutMs, displayErrors: false });
  vm.runInContext(prelude, context, options("orbbit-prelude.js"));
  phase = "candidate";
  vm.runInContext(code, context, options("candidate.js"));
  phase = "tests";
  vm.runInContext("{\n" + tests + "\n}", context, options("tests.js"));
  // Let any rejection from the test run surface before declaring success.
  setImmediate(() => finish({ status: "passed" }));
} catch (err) {
  const described = describe(err);
  let isTimeout = false;
  try {
    isTimeout = Boolean(err) && err.code === "ERR_SCRIPT_EXECUTION_TIMEOUT";
  } catch (e) {
    isTimeout = false;
  }
  if (isTimeout) {
    finish({ status: "timeout", phase, errorName: "TimeoutError", message: described.message });
  } else {
    finish(Object.assign({ status: phase === "setup" ? "error" : "failed", phase }, described));
  }
}
`;
