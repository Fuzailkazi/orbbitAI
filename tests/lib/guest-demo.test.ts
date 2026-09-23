import test from "node:test";
import assert from "node:assert/strict";
import {
  GUEST_SESSION_TTL_SECONDS,
  GuestDemoConfigError,
  createGuestDemoToken,
  isGuestDemoValue,
  resolveGuestDemoSecret,
  verifyGuestDemoToken,
} from "../../src/lib/auth/guest-demo";

const SECRET = Buffer.from("test-secret-please-ignore-0123456789", "utf8");
const OTHER = Buffer.from("another-secret-entirely-9876543210", "utf8");
const NOW = Date.UTC(2026, 0, 1);

test("guest token: round-trips with the same secret", () => {
  const token = createGuestDemoToken({ secret: SECRET, now: NOW });
  assert.match(token, /^v1\.\d+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
  assert.equal(verifyGuestDemoToken(token, { secret: SECRET, now: NOW }), true);
});

test("guest token: each token is unique (random nonce)", () => {
  const a = createGuestDemoToken({ secret: SECRET, now: NOW });
  const b = createGuestDemoToken({ secret: SECRET, now: NOW });
  assert.notEqual(a, b);
});

test("guest token: legacy unsigned and junk values are rejected", () => {
  for (const value of ["true", "", "false", "v1", "v1.1.2.3", "v1.9999999999.abcdefgh.", undefined, null]) {
    assert.equal(verifyGuestDemoToken(value, { secret: SECRET, now: NOW }), false, String(value));
  }
});

test("guest token: signature from another secret is rejected", () => {
  const token = createGuestDemoToken({ secret: OTHER, now: NOW });
  assert.equal(verifyGuestDemoToken(token, { secret: SECRET, now: NOW }), false);
});

test("guest token: tampering with the expiry or nonce invalidates it", () => {
  const token = createGuestDemoToken({ secret: SECRET, now: NOW });
  const [v, exp, nonce, sig] = token.split(".");
  const extended = [v, String(Number(exp) + 60 * 60 * 24 * 365), nonce, sig].join(".");
  const renonced = [v, exp, `${nonce.slice(0, -1)}${nonce.endsWith("A") ? "B" : "A"}`, sig].join(".");
  assert.equal(verifyGuestDemoToken(extended, { secret: SECRET, now: NOW }), false);
  assert.equal(verifyGuestDemoToken(renonced, { secret: SECRET, now: NOW }), false);
});

test("guest token: expires after the TTL", () => {
  const token = createGuestDemoToken({ secret: SECRET, now: NOW, ttlSeconds: 60 });
  assert.equal(verifyGuestDemoToken(token, { secret: SECRET, now: NOW + 59_000 }), true);
  assert.equal(verifyGuestDemoToken(token, { secret: SECRET, now: NOW + 60_000 }), false);

  const weekly = createGuestDemoToken({ secret: SECRET, now: NOW });
  const justBefore = NOW + (GUEST_SESSION_TTL_SECONDS - 1) * 1000;
  assert.equal(verifyGuestDemoToken(weekly, { secret: SECRET, now: justBefore }), true);
});

test("guest token: no secret configured → cannot mint, never verifies", () => {
  assert.throws(() => createGuestDemoToken({ secret: null }), GuestDemoConfigError);
  const token = createGuestDemoToken({ secret: SECRET, now: NOW });
  assert.equal(verifyGuestDemoToken(token, { secret: null, now: NOW }), false);
});

test("resolveGuestDemoSecret: prefers GUEST_DEMO_SECRET, else derives from the service key", () => {
  const explicit = resolveGuestDemoSecret({ GUEST_DEMO_SECRET: "x".repeat(32), SUPABASE_SERVICE_ROLE_KEY: "svc" });
  assert.deepEqual(explicit, Buffer.from("x".repeat(32), "utf8"));

  const derived = resolveGuestDemoSecret({ SUPABASE_SERVICE_ROLE_KEY: "service-role-key" });
  assert.ok(derived);
  assert.equal(derived.length, 32);
  // Derived, not the raw service-role key.
  assert.notDeepEqual(derived, Buffer.from("service-role-key", "utf8"));
  // Deterministic, so every instance verifies the same cookies.
  assert.deepEqual(derived, resolveGuestDemoSecret({ SUPABASE_SERVICE_ROLE_KEY: "service-role-key" }));

  // Too-short explicit secrets are ignored in favour of the derivation.
  const short = resolveGuestDemoSecret({ GUEST_DEMO_SECRET: "short", SUPABASE_SERVICE_ROLE_KEY: "service-role-key" });
  assert.deepEqual(short, derived);

  assert.equal(resolveGuestDemoSecret({}), null);
});

test("isGuestDemoValue: uses the process env secret", () => {
  const saved = process.env.GUEST_DEMO_SECRET;
  process.env.GUEST_DEMO_SECRET = SECRET.toString("utf8");
  try {
    assert.equal(isGuestDemoValue("true"), false);
    assert.equal(isGuestDemoValue(createGuestDemoToken()), true);
  } finally {
    if (saved === undefined) delete process.env.GUEST_DEMO_SECRET;
    else process.env.GUEST_DEMO_SECRET = saved;
  }
});
