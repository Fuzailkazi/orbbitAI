import test from "node:test";
import assert from "node:assert/strict";
import { clientIp, createRateLimiter, rateLimitedResponse } from "../../src/lib/api/rate-limit";

test("rate limiter: allows up to the limit, then blocks", () => {
  const rl = createRateLimiter({ limit: 3, windowMs: 1000 });
  assert.equal(rl.check("ip", 0).remaining, 2);
  assert.equal(rl.check("ip", 10).remaining, 1);
  assert.equal(rl.check("ip", 20).ok, true);
  const blocked = rl.check("ip", 30);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.remaining, 0);
  // Oldest hit (t=0) leaves the window at t=1000.
  assert.equal(blocked.retryAfterMs, 970);
});

test("rate limiter: sliding window frees slots one at a time", () => {
  const rl = createRateLimiter({ limit: 2, windowMs: 1000 });
  rl.check("ip", 0);
  rl.check("ip", 500);
  assert.equal(rl.check("ip", 999).ok, false);
  assert.equal(rl.check("ip", 1000).ok, true); // t=0 expired
  assert.equal(rl.check("ip", 1200).ok, false); // t=500 and t=1000 still in window
  assert.equal(rl.check("ip", 1500).ok, true); // t=500 expired
});

test("rate limiter: blocked attempts don't extend the window", () => {
  const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
  rl.check("ip", 0);
  for (let t = 100; t < 1000; t += 100) assert.equal(rl.check("ip", t).ok, false);
  assert.equal(rl.check("ip", 1000).ok, true);
});

test("rate limiter: keys are independent", () => {
  const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
  assert.equal(rl.check("a", 0).ok, true);
  assert.equal(rl.check("a", 1).ok, false);
  assert.equal(rl.check("b", 1).ok, true);
});

test("rate limiter: sweeps expired keys when the key cap is reached", () => {
  const rl = createRateLimiter({ limit: 1, windowMs: 100, maxKeys: 3 });
  rl.check("a", 0);
  rl.check("b", 0);
  rl.check("c", 0);
  assert.equal(rl.size(), 3);
  rl.check("d", 500);
  assert.equal(rl.size(), 1);
  rl.reset();
  assert.equal(rl.size(), 0);
});

test("rate limiter: rejects invalid configuration", () => {
  assert.throws(() => createRateLimiter({ limit: 0, windowMs: 1000 }));
  assert.throws(() => createRateLimiter({ limit: 1, windowMs: 0 }));
});

test("clientIp: first x-forwarded-for hop, then x-real-ip, then unknown", () => {
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
  assert.equal(clientIp(new Headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
  assert.equal(clientIp(new Headers()), "unknown");
});

test("rateLimitedResponse: 429 with typed body and Retry-After", async () => {
  const res = rateLimitedResponse({ ok: false, limit: 3, remaining: 0, retryAfterMs: 4200 }, "evaluation");
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Retry-After"), "5");
  const body = (await res.json()) as { error: string; code: string };
  assert.equal(body.code, "RATE_LIMITED");
  assert.match(body.error, /Too many evaluation requests/);
});

test("rate limiter: stays bounded at maxKeys when every key is still active", () => {
  const rl = createRateLimiter({ limit: 5, windowMs: 60_000, maxKeys: 10 });
  for (let i = 0; i < 1_000; i++) rl.check(`ip-${i}`, 1_000 + i);
  assert.ok(rl.size() <= 10, `size ${rl.size()} exceeded maxKeys`);
  // The most recent key is still tracked.
  assert.equal(rl.check("ip-999", 3_000).remaining, 3);
});
