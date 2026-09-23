import test from "node:test";
import assert from "node:assert/strict";
import { calculateCostUsd, OpenRouterClient } from "../../src/lib/openrouter/client";
import {
  DEFAULT_JUDGE_MODEL,
  isFreeModelId,
  resolveJudgeModel,
} from "../../src/lib/openrouter/free-models";

test("isFreeModelId: only :free identifiers qualify", () => {
  assert.equal(isFreeModelId("meta-llama/llama-3.3-70b-instruct:free"), true);
  assert.equal(isFreeModelId("openai/gpt-4o"), false);
  assert.equal(isFreeModelId("openai/gpt-4o:free-trial"), false);
  assert.equal(isFreeModelId(""), false);
  assert.equal(isFreeModelId(null), false);
});

test("resolveJudgeModel: never resolves to a paid judge", () => {
  assert.equal(resolveJudgeModel(undefined), DEFAULT_JUDGE_MODEL);
  assert.equal(resolveJudgeModel("openai/gpt-4o-mini"), DEFAULT_JUDGE_MODEL);
  assert.equal(resolveJudgeModel("google/gemma-3-27b-it:free"), "google/gemma-3-27b-it:free");
  assert.ok(isFreeModelId(DEFAULT_JUDGE_MODEL));
});

test("calculateCostUsd: actual tokens × $/1M pricing (rule 7)", () => {
  // 1,000 prompt tokens @ $2.50/M + 500 completion tokens @ $10/M
  const cost = calculateCostUsd(1000, 500, { input: 2.5, output: 10 });
  assert.ok(Math.abs(cost - 0.0075) < 1e-12);
  assert.equal(calculateCostUsd(1000, 500, { input: 0, output: 0 }), 0);
  assert.equal(calculateCostUsd(1000, 500, { input: Number.NaN, output: -1 }), 0);
});

test("OpenRouterClient: fails fast without an API key and makes no request", async () => {
  const saved = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    await assert.rejects(
      () => new OpenRouterClient().createChatCompletion({ model: "x:free", messages: [] }),
      /OPENROUTER_API_KEY is not configured/
    );
  } finally {
    if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved;
  }
});

test("OpenRouterClient: a failed call is thrown once, never retried silently (rule 9)", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("rate limited", { status: 429 });
  };
  try {
    const client = new OpenRouterClient("test-key");
    await assert.rejects(
      () => client.createChatCompletion({ model: "x:free", messages: [{ role: "user", content: "hi" }] }),
      /429/
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenRouterClient: computes cost from reported usage and does not estimate TTFT", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "B" } }],
        usage: { prompt_tokens: 2000, completion_tokens: 100, total_tokens: 2100 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  try {
    const client = new OpenRouterClient("test-key");
    const res = await client.createChatCompletion(
      { model: "x:free", messages: [{ role: "user", content: "hi" }] },
      { input: 1, output: 2 }
    );
    assert.equal(res.text, "B");
    assert.equal(res.promptTokens, 2000);
    assert.equal(res.completionTokens, 100);
    assert.equal(res.totalTokens, 2100);
    assert.ok(Math.abs(res.costUsd - (2000 * 1 + 100 * 2) / 1_000_000) < 1e-12);
    assert.equal(res.timeToFirstTokenMs, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenRouterClient: surfaces provider errors embedded in a 200 response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "Provider returned error", code: 502 } }), { status: 200 });
  try {
    const client = new OpenRouterClient("test-key");
    await assert.rejects(
      () => client.createChatCompletion({ model: "x:free", messages: [] }),
      /Provider returned error/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("upstreamErrorMessage: extracts error.message and drops account metadata", async () => {
  const { upstreamErrorMessage } = await import("../../src/lib/openrouter/client");
  const body = JSON.stringify({ error: { message: "This model is unavailable for free.", code: 404 }, user_id: "user_123" });
  assert.equal(upstreamErrorMessage(body), "This model is unavailable for free.");
  assert.equal(upstreamErrorMessage("Bad Gateway"), "Bad Gateway");
  assert.equal(upstreamErrorMessage(""), "");
});

// ---------- error classification & quota awareness ----------

test("classifyOpenRouterFailure: per-minute vs daily vs unavailable vs credits vs auth", async () => {
  const { classifyOpenRouterFailure, isQuotaStop } = await import("../../src/lib/openrouter/errors");
  const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });
  const now = Date.UTC(2026, 8, 23, 12, 0, 0);

  assert.equal(classifyOpenRouterFailure(429, "Rate limit exceeded: free-models-per-min.").kind, "rate_limited_minute");
  assert.equal(classifyOpenRouterFailure(429, "Rate limit exceeded: free-models-per-day. Add 10 credits…").kind, "daily_quota_exhausted");
  assert.equal(classifyOpenRouterFailure(429, "Rate limit exceeded: free-models-per-day-high-balance").kind, "daily_quota_exhausted");
  // No bucket in the message: a far-away reset with 0 remaining means the daily bucket.
  const daily = classifyOpenRouterFailure(429, "Rate limit exceeded", headers({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(now + 6 * 3_600_000) }), now);
  assert.equal(daily.kind, "daily_quota_exhausted");
  const minute = classifyOpenRouterFailure(429, "Rate limit exceeded", headers({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(now + 20_000) }), now);
  assert.equal(minute.kind, "rate_limited_minute");
  assert.equal(minute.retryAfterMs, 20_000);
  assert.equal(classifyOpenRouterFailure(429, "google/gemma-3-27b-it:free is temporarily rate-limited upstream.").kind, "rate_limited_minute");

  assert.equal(
    classifyOpenRouterFailure(404, "This model is unavailable for free. The paid version is available now").kind,
    "model_unavailable"
  );
  assert.equal(classifyOpenRouterFailure(200, "No endpoints found for x/y:free.").kind, "model_unavailable");
  assert.equal(classifyOpenRouterFailure(402, "Insufficient credits").kind, "insufficient_credits");
  assert.equal(classifyOpenRouterFailure(401, "No auth credentials found").kind, "auth");
  assert.equal(classifyOpenRouterFailure(502, "Bad gateway").kind, "other");

  assert.equal(isQuotaStop("daily_quota_exhausted"), true);
  assert.equal(isQuotaStop("insufficient_credits"), true);
  assert.equal(isQuotaStop("rate_limited_minute"), false);
  assert.equal(isQuotaStop("model_unavailable"), false);
});

test("OpenRouterClient: thrown errors carry their kind (daily quota stops the batch)", async () => {
  const { OpenRouterError } = await import("../../src/lib/openrouter/client");
  const originalFetch = globalThis.fetch;
  const bodies: Array<[number, string]> = [
    [429, JSON.stringify({ error: { message: "Rate limit exceeded: free-models-per-day", code: 429 } })],
    [404, JSON.stringify({ error: { message: "No endpoints found for x:free.", code: 404 } })],
  ];
  let call = 0;
  globalThis.fetch = async () => {
    const [status, body] = bodies[call++];
    return new Response(body, { status });
  };
  try {
    const client = new OpenRouterClient("test-key");
    const first = await client.createChatCompletion({ model: "x:free", messages: [] }).catch((e: unknown) => e);
    assert.ok(first instanceof OpenRouterError);
    assert.equal(first.kind, "daily_quota_exhausted");
    assert.equal(first.stopsBatch, true);
    const second = await client.createChatCompletion({ model: "x:free", messages: [] }).catch((e: unknown) => e);
    assert.ok(second instanceof OpenRouterError);
    assert.equal(second.kind, "model_unavailable");
    assert.equal(second.stopsBatch, false);
    assert.equal(call, 2); // one request per call — never retried
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenRouterClient: embedded 200 error uses its own code for classification", async () => {
  const { OpenRouterError } = await import("../../src/lib/openrouter/client");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "Rate limit exceeded: free-models-per-min", code: 429 } }), { status: 200 });
  try {
    const err = await new OpenRouterClient("test-key").createChatCompletion({ model: "x:free", messages: [] }).catch((e: unknown) => e);
    assert.ok(err instanceof OpenRouterError);
    assert.equal(err.kind, "rate_limited_minute");
    assert.equal(err.status, 429);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenRouterClient: an operator abort surfaces as kind 'aborted'", async () => {
  const { OpenRouterError } = await import("../../src/lib/openrouter/client");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_input: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
  try {
    const ctrl = new AbortController();
    const pending = new OpenRouterClient("test-key")
      .createChatCompletion({ model: "x:free", messages: [] }, undefined, { signal: ctrl.signal })
      .catch((e: unknown) => e);
    ctrl.abort();
    const err = await pending;
    assert.ok(err instanceof OpenRouterError);
    assert.equal(err.kind, "aborted");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("completionText: reasoning-only replies are wrapped so scorers never grade them", async () => {
  const { completionText } = await import("../../src/lib/openrouter/client");
  assert.equal(completionText("Answer: B", "long thoughts"), "Answer: B");
  assert.equal(completionText("", "thinking… Answer: B"), "<think>thinking… Answer: B</think>");
  assert.equal(completionText(null, null), "");
});

test("parseKeyStatus: reads the free-model daily counter defensively", async () => {
  const { parseKeyStatus } = await import("../../src/lib/openrouter/client");
  assert.deepEqual(
    parseKeyStatus({ data: { is_free_tier: true, free_model_daily_requests: { used: 7, limit: 50, remaining: 43 } } }),
    { isFreeTier: true, freeModelDailyRequests: { used: 7, limit: 50, remaining: 43 } }
  );
  assert.deepEqual(parseKeyStatus({ data: { is_free_tier: false } }), { isFreeTier: false, freeModelDailyRequests: null });
  assert.deepEqual(parseKeyStatus(null), { isFreeTier: true, freeModelDailyRequests: null });
});

test("parseModelIds: reads ids from GET /models defensively", async () => {
  const { parseModelIds } = await import("../../src/lib/openrouter/client");
  const ids = parseModelIds({ data: [{ id: "google/gemma-4-31b-it:free" }, { id: 5 }, null, { name: "x" }] });
  assert.deepEqual([...ids], ["google/gemma-4-31b-it:free"]);
  assert.equal(parseModelIds(null).size, 0);
  assert.equal(parseModelIds({ data: "nope" }).size, 0);
});
