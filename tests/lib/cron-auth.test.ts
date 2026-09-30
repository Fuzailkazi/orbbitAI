import test from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedCronRequest } from "../../src/lib/cron/auth";

const SECRET = "s".repeat(32);

test("isAuthorizedCronRequest: accepts the exact bearer token", () => {
  assert.equal(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET), true);
});

test("isAuthorizedCronRequest: rejects a wrong or differently-sized token", () => {
  assert.equal(isAuthorizedCronRequest("Bearer wrong", SECRET), false);
  assert.equal(isAuthorizedCronRequest(`Bearer ${SECRET}x`, SECRET), false);
  assert.equal(isAuthorizedCronRequest(SECRET, SECRET), false);
});

test("isAuthorizedCronRequest: fails closed without a header or a configured secret", () => {
  assert.equal(isAuthorizedCronRequest(null, SECRET), false);
  assert.equal(isAuthorizedCronRequest(`Bearer ${SECRET}`, undefined), false);
  assert.equal(isAuthorizedCronRequest("Bearer ", ""), false);
});
