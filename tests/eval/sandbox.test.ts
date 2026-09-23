import test from "node:test";
import assert from "node:assert/strict";
import { runJavaScriptTests } from "../../src/lib/eval/sandbox/run-javascript";

/** Real MultiPL-E row: nuprl/MultiPL-E, config humaneval-js, split test, row 1. */
const HUMANEVAL_JS_1_TESTS =
  "const assert = require('node:assert');\n\n\nfunction test() {\n  let candidate = separate_paren_groups;\n  assert.deepEqual(candidate(\"(()()) ((())) () ((())()())\"),[\"(()())\", \"((()))\", \"()\", \"((())()())\"]);\n  assert.deepEqual(candidate(\"() (()) ((())) (((())))\"),[\"()\", \"(())\", \"((()))\", \"(((())))\"]);\n  assert.deepEqual(candidate(\"(()(())((())))\"),[\"(()(())((())))\"]);\n  assert.deepEqual(candidate(\"( ) (( )) (( )( ))\"),[\"()\", \"(())\", \"(()())\"]);\n}\n\ntest();";

const SEPARATE_PAREN_GROUPS = `function separate_paren_groups(paren_string){
  const groups = [];
  let depth = 0;
  let current = "";
  for (const ch of paren_string) {
    if (ch === "(") { depth++; current += ch; }
    else if (ch === ")") {
      depth--; current += ch;
      if (depth === 0) { groups.push(current); current = ""; }
    }
  }
  return groups;
}`;

const ADD_TESTS =
  "const assert = require('node:assert');\n\nfunction test() {\n  let candidate = add;\n  assert.deepEqual(candidate(1, 2), 3);\n}\n\ntest();";

test("sandbox: passing MultiPL-E solution", async () => {
  const res = await runJavaScriptTests(SEPARATE_PAREN_GROUPS, HUMANEVAL_JS_1_TESTS);
  assert.equal(res.status, "passed", res.message);
});

test("sandbox: failing assertion", async () => {
  const wrong = SEPARATE_PAREN_GROUPS.replace("groups.push(current)", "groups.push(current.trim() + ' ')");
  const res = await runJavaScriptTests(wrong, HUMANEVAL_JS_1_TESTS);
  assert.equal(res.status, "failed");
  assert.equal(res.phase, "tests");
  assert.equal(res.errorName, "AssertionError");
});

test("sandbox: infinite loop → timeout", async () => {
  const res = await runJavaScriptTests("function add(a, b) { while (true) {} }", ADD_TESTS, { timeoutMs: 1_000 });
  assert.equal(res.status, "timeout");
  assert.ok(res.durationMs < 5_000);
});

test("sandbox: no process access", async () => {
  const res = await runJavaScriptTests("function add(a, b) { process.exit(0); return a + b; }", ADD_TESTS);
  assert.equal(res.status, "failed");
  assert.match(res.message ?? "", /process is not defined/);
});

test("sandbox: require('fs') and other modules are refused", async () => {
  for (const mod of ["fs", "node:fs", "child_process", "node:assert/strict"]) {
    const res = await runJavaScriptTests(`const m = require(${JSON.stringify(mod)}); function add(a, b) { return a + b; }`, ADD_TESTS);
    assert.equal(res.status, "failed", mod);
    assert.equal(res.phase, "candidate", mod);
  }
});

test("sandbox: constructor-chain escape to the host realm is blocked", async () => {
  const res = await runJavaScriptTests(
    "const p = this.constructor.constructor('return process')(); function add(a, b) { return a + b; }",
    ADD_TESTS
  );
  assert.equal(res.status, "failed");
});

test("sandbox: no timers, fetch or eval", async () => {
  for (const snippet of ["setTimeout(() => {}, 1);", "fetch('https://example.com');", "eval('1');", "new Function('return 1')();"]) {
    const res = await runJavaScriptTests(`${snippet}\nfunction add(a, b) { return a + b; }`, ADD_TESTS);
    assert.equal(res.status, "failed", snippet);
  }
});

test("sandbox: syntax error", async () => {
  const res = await runJavaScriptTests("function add(a, b) { return a + }", ADD_TESTS);
  assert.equal(res.status, "failed");
  assert.equal(res.phase, "candidate");
  assert.equal(res.errorName, "SyntaxError");
});

test("sandbox: memory blow-up is contained and fails", async () => {
  const res = await runJavaScriptTests(
    "const keep = []; function add(a, b) { for (;;) keep.push(new Array(1e6).fill(a)); }",
    ADD_TESTS,
    { timeoutMs: 4_000 }
  );
  assert.notEqual(res.status, "passed");
  assert.notEqual(res.status, "error");
});

test("sandbox: candidate cannot replace require/assert to fake a pass", async () => {
  const overrideVar = await runJavaScriptTests(
    "var require = () => ({ deepEqual() {} }); function add() { return 0; }",
    ADD_TESTS
  );
  assert.equal(overrideVar.status, "failed");
  const overrideLet = await runJavaScriptTests(
    "let require = () => ({ deepEqual() {} }); function add() { return 0; }",
    ADD_TESTS
  );
  assert.equal(overrideLet.status, "failed");
});

test("sandbox: candidate's own `const assert = require('node:assert')` does not collide with the tests", async () => {
  const res = await runJavaScriptTests(
    "const assert = require('node:assert');\nfunction add(a, b) { return a + b; }\nassert.equal(add(2, 2), 4);",
    ADD_TESTS
  );
  assert.equal(res.status, "passed", res.message);
});

test("sandbox: assert shim follows node:assert semantics", async () => {
  const cases: Array<[string, boolean]> = [
    ["assert.deepEqual([1, [2, {a: 3}]], [1, [2, {a: 3}]]);", true],
    ["assert.deepEqual(1, '1');", true], // legacy loose mode, as node:assert
    ["assert.deepEqual([1, 2], [1, 2, 3]);", false],
    ["assert.deepEqual({a: 1}, {a: 1, b: 2});", false],
    ["assert.deepEqual(NaN, NaN);", true],
    ["assert.deepEqual(undefined, null);", true],
    ["assert.deepEqual([0.1 + 0.2], [0.3]);", false],
    ["assert.deepStrictEqual(1, '1');", false],
    ["assert.deepStrictEqual({a: [1]}, {a: [1]});", true],
    ["assert.deepStrictEqual(new Map([[1, 'a']]), new Map([[1, 'a']]));", true],
    ["assert.deepStrictEqual(new Set([1, 2]), new Set([2, 3]));", false],
    ["assert.equal(1, '1');", true],
    ["assert.strictEqual(1, '1');", false],
    ["assert.notEqual(1, 2);", true],
    ["assert.ok(0);", false],
    ["assert(true);", true],
    ["assert.throws(() => { throw new TypeError('x'); }, TypeError);", true],
    ["assert.throws(() => {});", false],
    ["assert.throws(() => { throw new Error('boom'); }, /boom/);", true],
  ];
  for (const [line, shouldPass] of cases) {
    const res = await runJavaScriptTests("", `const assert = require('node:assert');\n${line}`);
    assert.equal(res.status, shouldPass ? "passed" : "failed", `${line} → ${res.status} ${res.message ?? ""}`);
  }
});
