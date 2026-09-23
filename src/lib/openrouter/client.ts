import {
  classifyOpenRouterFailure,
  isQuotaStop,
  type HeaderReader,
  type OpenRouterErrorKind,
} from "./errors";

export type { OpenRouterErrorKind } from "./errors";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterCompletionOptions {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  stop?: string[];
}

/** $/1M tokens, as stored in models.pricing_input / pricing_output. */
export interface OpenRouterPricing {
  input: number;
  output: number;
}

/** Subset of the OpenRouter chat completion response we rely on. */
export interface OpenRouterChatResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      role?: string;
      content?: string | null;
      reasoning?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; code?: number | string };
}

export interface OpenRouterCompletionResult {
  /**
   * The model's final answer (`message.content`). When the model produced only reasoning
   * (e.g. it hit max_tokens mid-thought), the reasoning is returned wrapped in
   * `<think>…</think>` so it stays visible in the drill-down but scorers — which strip think
   * blocks — never grade unfinished reasoning as an answer.
   */
  text: string;
  finishReason: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  /** Not measurable on non-streaming calls — always null rather than an estimate. */
  timeToFirstTokenMs: number | null;
  /** Actual usage tokens × model pricing (rule 7). 0 for free models / when pricing is not supplied. */
  costUsd: number;
  rawResponse?: OpenRouterChatResponse;
}

export class OpenRouterError extends Error {
  readonly status: number | null;
  readonly kind: OpenRouterErrorKind;
  /** Suggested pause before the next request, when the upstream said so. */
  readonly retryAfterMs: number | null;
  constructor(
    message: string,
    status: number | null = null,
    kind: OpenRouterErrorKind = "other",
    retryAfterMs: number | null = null
  ) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }

  /** True when no further request can succeed today (daily quota, credits, auth). */
  get stopsBatch(): boolean {
    return isQuotaStop(this.kind);
  }
}

/** The error kind of any thrown value (`other` for non-OpenRouter errors). */
export function openRouterErrorKind(err: unknown): OpenRouterErrorKind {
  return err instanceof OpenRouterError ? err.kind : "other";
}

const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

export interface OpenRouterCallOptions {
  /** Per-call timeout in ms; clamped to the client timeout. */
  timeoutMs?: number;
  /** Aborts the in-flight request (operator interrupt). Surfaces as kind `aborted`. */
  signal?: AbortSignal;
}

/** Daily free-model request counter for the key (GET /api/v1/key). */
export interface OpenRouterKeyStatus {
  isFreeTier: boolean;
  /** null when the endpoint did not report it. */
  freeModelDailyRequests: { used: number; limit: number; remaining: number } | null;
}

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function toPrice(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
}

function toNonNegativeInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

/**
 * Human-readable upstream error: the JSON `error.message` when present (dropping account
 * metadata such as `user_id` that OpenRouter includes in the body), else the raw text.
 */
export function upstreamErrorMessage(rawBody: string): string {
  const raw = rawBody.trim();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
      const err = (parsed as { error: unknown }).error;
      if (typeof err === "object" && err !== null && "message" in err) {
        const message = (err as { message: unknown }).message;
        if (typeof message === "string" && message.trim()) return message.trim().slice(0, 500);
      }
    }
  } catch {
    // Not JSON — fall through to the raw text.
  }
  return raw.slice(0, 500);
}

/** Cost in USD from actual token usage and $/1M pricing. */
export function calculateCostUsd(
  promptTokens: number,
  completionTokens: number,
  pricing: OpenRouterPricing
): number {
  return (
    (promptTokens * toPrice(pricing.input)) / 1_000_000 +
    (completionTokens * toPrice(pricing.output)) / 1_000_000
  );
}

/** Answer text for scoring; reasoning-only replies are wrapped so scorers ignore them. */
export function completionText(content: string | null | undefined, reasoning: string | null | undefined): string {
  if (typeof content === "string" && content.trim()) return content;
  if (typeof reasoning === "string" && reasoning.trim()) return `<think>${reasoning}</think>`;
  return "";
}

function buildError(
  message: string,
  status: number | null,
  headers?: HeaderReader,
  now: number = Date.now()
): OpenRouterError {
  const { kind, retryAfterMs } = classifyOpenRouterFailure(status, message, headers, now);
  return new OpenRouterError(message, status, kind, retryAfterMs);
}

/**
 * Single integration point for model calls (CLAUDE.md rule 3).
 * Failures are thrown once — never retried silently — so the runner can record them (rule 9).
 * Every thrown OpenRouterError carries a `kind` (see ./errors.ts) so callers can tell a
 * per-minute throttle from an exhausted daily quota or a model that left the free tier.
 */
export class OpenRouterClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(apiKey?: string, baseUrl = DEFAULT_BASE_URL, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || "";
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Orbbit AI Model Benchmark",
    };
  }

  async createChatCompletion(
    options: OpenRouterCompletionOptions,
    pricing?: OpenRouterPricing,
    callOptions: OpenRouterCallOptions = {}
  ): Promise<OpenRouterCompletionResult> {
    // A caller with a wall-clock deadline (the eval runner) may shorten — never extend — the timeout.
    const timeoutMs =
      callOptions.timeoutMs !== undefined && Number.isFinite(callOptions.timeoutMs) && callOptions.timeoutMs > 0
        ? Math.min(this.timeoutMs, Math.round(callOptions.timeoutMs))
        : this.timeoutMs;
    if (!this.apiKey) {
      throw new OpenRouterError("OPENROUTER_API_KEY is not configured.", null, "auth");
    }
    if (callOptions.signal?.aborted) {
      throw new OpenRouterError("OpenRouter request aborted before it started.", null, "aborted");
    }

    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = callOptions.signal ? AbortSignal.any([timeoutSignal, callOptions.signal]) : timeoutSignal;
    const startTime = performance.now();

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          temperature: options.temperature ?? 0,
          max_tokens: options.max_tokens ?? 1024,
          stop: options.stop,
        }),
        signal,
      });
    } catch (err) {
      if (callOptions.signal?.aborted) {
        throw new OpenRouterError("OpenRouter request aborted by the operator.", null, "aborted");
      }
      const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      if (isTimeout) {
        throw new OpenRouterError(`OpenRouter request timed out after ${Math.round(timeoutMs / 1000)}s.`, null, "timeout");
      }
      throw new OpenRouterError(
        `OpenRouter network error: ${err instanceof Error ? err.message : String(err)}`,
        null,
        "network"
      );
    }

    if (!response.ok) {
      const errorBody = upstreamErrorMessage(await response.text().catch(() => ""));
      const label = response.status === 429 ? "rate limited" : "API error";
      throw buildError(`OpenRouter ${label} (${response.status}): ${errorBody}`, response.status, response.headers);
    }

    let data: OpenRouterChatResponse;
    try {
      data = (await response.json()) as OpenRouterChatResponse;
    } catch {
      throw new OpenRouterError("OpenRouter returned a non-JSON response.", response.status, "other");
    }

    // OpenRouter can return 200 with an embedded provider error (its code is the real status).
    if (data.error?.message) {
      const embedded = Number(data.error.code);
      const status = Number.isInteger(embedded) && embedded >= 400 ? embedded : response.status;
      throw buildError(`OpenRouter provider error: ${data.error.message}`, status, response.headers);
    }

    const latencyMs = Math.round(performance.now() - startTime);
    const choice = data.choices?.[0];
    const text = completionText(choice?.message?.content, choice?.message?.reasoning);
    const promptTokens = toCount(data.usage?.prompt_tokens);
    const completionTokens = toCount(data.usage?.completion_tokens);
    const totalTokens = toCount(data.usage?.total_tokens) || promptTokens + completionTokens;
    const costUsd = pricing ? calculateCostUsd(promptTokens, completionTokens, pricing) : 0;

    return {
      text,
      finishReason: choice?.finish_reason ?? null,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
      timeToFirstTokenMs: null,
      costUsd,
      rawResponse: data,
    };
  }

  /**
   * GET /api/v1/models — ids currently served by OpenRouter. Not a model call: it does not
   * consume free-model quota. Used to drop catalog rows whose free variant has been retired
   * before spending a request on them. Throws OpenRouterError on failure.
   */
  async listModelIds(timeoutMs = 15_000): Promise<Set<string>> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/models`, { headers: this.headers(), signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      throw new OpenRouterError(
        `OpenRouter model list failed: ${err instanceof Error ? err.message : String(err)}`,
        null,
        "network"
      );
    }
    if (!response.ok) {
      const errorBody = upstreamErrorMessage(await response.text().catch(() => ""));
      throw buildError(`OpenRouter model list error (${response.status}): ${errorBody}`, response.status, response.headers);
    }
    return parseModelIds(await response.json().catch(() => null));
  }

  /**
   * GET /api/v1/key — the key's free-model daily counter. Not a model call: it does not
   * consume free-model quota. Throws OpenRouterError on failure.
   */
  async getKeyStatus(timeoutMs = 15_000): Promise<OpenRouterKeyStatus> {
    if (!this.apiKey) {
      throw new OpenRouterError("OPENROUTER_API_KEY is not configured.", null, "auth");
    }
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/key`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new OpenRouterError(
        `OpenRouter key lookup failed: ${err instanceof Error ? err.message : String(err)}`,
        null,
        "network"
      );
    }
    if (!response.ok) {
      const errorBody = upstreamErrorMessage(await response.text().catch(() => ""));
      throw buildError(`OpenRouter key lookup error (${response.status}): ${errorBody}`, response.status, response.headers);
    }
    const body: unknown = await response.json().catch(() => null);
    return parseKeyStatus(body);
  }
}

/** Parses the GET /api/v1/models body defensively (exported for tests). */
export function parseModelIds(body: unknown): Set<string> {
  const ids = new Set<string>();
  const data = typeof body === "object" && body !== null && "data" in body ? (body as { data: unknown }).data : null;
  if (!Array.isArray(data)) return ids;
  for (const entry of data) {
    const id = typeof entry === "object" && entry !== null ? (entry as { id?: unknown }).id : null;
    if (typeof id === "string" && id) ids.add(id);
  }
  return ids;
}

/** Parses the GET /api/v1/key body defensively (exported for tests). */
export function parseKeyStatus(body: unknown): OpenRouterKeyStatus {
  const data =
    typeof body === "object" && body !== null && "data" in body ? (body as { data: unknown }).data : null;
  if (typeof data !== "object" || data === null) {
    return { isFreeTier: true, freeModelDailyRequests: null };
  }
  const record = data as Record<string, unknown>;
  const daily = record.free_model_daily_requests;
  let freeModelDailyRequests: OpenRouterKeyStatus["freeModelDailyRequests"] = null;
  if (typeof daily === "object" && daily !== null) {
    const d = daily as Record<string, unknown>;
    const used = toNonNegativeInt(d.used);
    const limit = toNonNegativeInt(d.limit);
    const remaining = toNonNegativeInt(d.remaining);
    if (used !== null && limit !== null) {
      freeModelDailyRequests = { used, limit, remaining: remaining ?? Math.max(0, limit - used) };
    }
  }
  return { isFreeTier: record.is_free_tier !== false, freeModelDailyRequests };
}
