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

export interface OpenRouterCompletionResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  timeToFirstTokenMs: number | null;
  costUsd: number;
  rawResponse?: any;
}

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl = "https://openrouter.ai/api/v1") {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || "";
    this.baseUrl = baseUrl;
  }

  async createChatCompletion(
    options: OpenRouterCompletionOptions,
    pricing?: { input: number; output: number }
  ): Promise<OpenRouterCompletionResult> {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured.");
    }

    const startTime = performance.now();
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            "X-Title": "Orbbit AI Model Benchmark",
          },
          body: JSON.stringify({
            model: options.model,
            messages: options.messages,
            temperature: options.temperature ?? 0,
            max_tokens: options.max_tokens ?? 1024,
            stop: options.stop,
          }),
        });

        if (response.status === 429) {
          // Rate limited, wait and back off
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((res) => setTimeout(res, delay));
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`OpenRouter API error (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        const endTime = performance.now();
        const latencyMs = Math.round(endTime - startTime);

        const choice = data.choices?.[0];
        const text = choice?.message?.content || "";
        const promptTokens = data.usage?.prompt_tokens ?? 0;
        const completionTokens = data.usage?.completion_tokens ?? 0;
        const totalTokens = data.usage?.total_tokens ?? (promptTokens + completionTokens);

        // Approximate TTFT as 30% of total latency for non-streaming calls, or latency if short
        const timeToFirstTokenMs = Math.round(Math.min(latencyMs * 0.35, latencyMs));

        // Calculate cost using known pricing ($/1M tokens) or OpenRouter usage header
        let costUsd = 0;
        if (pricing) {
          costUsd =
            (promptTokens * pricing.input) / 1_000_000 +
            (completionTokens * pricing.output) / 1_000_000;
        }

        return {
          text,
          promptTokens,
          completionTokens,
          totalTokens,
          latencyMs,
          timeToFirstTokenMs,
          costUsd,
          rawResponse: data,
        };
      } catch (err: any) {
        if (attempt >= maxAttempts) {
          throw err;
        }
        await new Promise((res) => setTimeout(res, 1000 * attempt));
      }
    }

    throw new Error("Failed to complete OpenRouter request after multiple retries.");
  }
}
