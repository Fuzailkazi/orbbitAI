import test from "node:test";
import assert from "node:assert/strict";
import { isProtectedSpaceName, normalizeSpaceName } from "../../src/lib/spaces/protected";

test("isProtectedSpaceName: curated names match case- and whitespace-insensitively", () => {
  for (const name of ["Mathematics", "mathematics", "  MATHEMATICS ", "code   generation", "Chat Quality"]) {
    assert.equal(isProtectedSpaceName(name), true, name);
  }
  for (const name of ["Math", "Mathematics 2", "My Reasoning Space"]) {
    assert.equal(isProtectedSpaceName(name), false, name);
  }
});

test("normalizeSpaceName: canonical form", () => {
  assert.equal(normalizeSpaceName("  Code\tGeneration  "), "code generation");
});
