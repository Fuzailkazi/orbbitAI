import test from "node:test";
import assert from "node:assert/strict";
import { safeRedirectPath } from "../../src/lib/auth/redirect";

test("safeRedirectPath: keeps same-origin paths with query and hash", () => {
  assert.equal(safeRedirectPath("/dashboard/evaluations/abc?x=1#r"), "/dashboard/evaluations/abc?x=1#r");
});

test("safeRedirectPath: falls back for empty, absolute and protocol-relative values", () => {
  for (const bad of [null, undefined, "", "dashboard", "https://evil.com", "//evil.com", "/\\evil.com"]) {
    assert.equal(safeRedirectPath(bad), "/dashboard", String(bad));
  }
});

test("safeRedirectPath: rejects control-character tricks the URL parser would strip", () => {
  for (const bad of ["/\t/evil.com", "/\n/evil.com", "/\r\n/evil.com", "/%00", "/\u0000x"]) {
    const out = safeRedirectPath(bad);
    assert.ok(out.startsWith("/") && !out.startsWith("//"), JSON.stringify(bad));
  }
  assert.equal(safeRedirectPath("/\t/evil.com"), "/dashboard");
});

test("safeRedirectPath: honours a custom fallback", () => {
  assert.equal(safeRedirectPath("//x", "/login"), "/login");
});
