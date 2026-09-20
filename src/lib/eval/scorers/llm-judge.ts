import { Scorer, ScoringResult } from "../types";
import { OpenRouterClient } from "../../openrouter/client";

export class LLMJudgeScorer implements Scorer {
  name = "llm_judge";
  private judgeModel: string;
  private openRouter: OpenRouterClient;

  constructor(judgeModel = "openai/gpt-4o-mini") {
    this.judgeModel = process.env.JUDGE_MODEL || judgeModel;
    this.openRouter = new OpenRouterClient();
  }

  async score(
    response: string,
    expected: string,
    metadata?: Record<string, any>
  ): Promise<ScoringResult> {
    const trimmedResponse = response?.trim() || "";
    const trimmedExpected = expected?.trim() || "";

    if (!trimmedResponse) {
      return {
        isCorrect: false,
        score: 0.0,
        reasoning: "Empty candidate response provided to LLM judge.",
      };
    }

    // Attempt automated LLM-as-a-Judge grading
    try {
      if (process.env.OPENROUTER_API_KEY) {
        const rubricPrompt = `You are an expert impartial AI evaluation judge.
Evaluate the candidate AI model response against the expected ground truth answer.

[EXPECTED GROUND TRUTH]
${trimmedExpected}

[CANDIDATE RESPONSE]
${trimmedResponse}

CRITERIA:
1. Accuracy: Does the candidate response state the correct answer or solution?
2. Completeness: Does it address the essential requirements of the prompt?
3. Faithfulness: Is it free of contradictions or hallucinations?

Return ONLY a JSON object with this exact schema:
{
  "isCorrect": boolean,
  "score": number, // 0.0 to 1.0 (1.0 = fully correct, 0.5 = partially correct, 0.0 = incorrect)
  "reasoning": string // 1-2 sentence concise explanation
}`;

        const judgeResponse = await this.openRouter.createChatCompletion({
          model: this.judgeModel,
          messages: [
            {
              role: "system",
              content:
                "You are an impartial AI evaluation judge. Output only valid JSON without markdown fences.",
            },
            {
              role: "user",
              content: rubricPrompt,
            },
          ],
          temperature: 0,
          max_tokens: 300,
        });

        const rawText = judgeResponse.text.trim();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            isCorrect: Boolean(parsed.isCorrect),
            score: typeof parsed.score === "number" ? Math.max(0, Math.min(1, parsed.score)) : (parsed.isCorrect ? 1.0 : 0.0),
            reasoning: `[LLM Judge: ${this.judgeModel}] ${parsed.reasoning || "Evaluated by judge model."}`,
            metadata: { judgeModel: this.judgeModel, judgeLatencyMs: judgeResponse.latencyMs },
          };
        }
      }
    } catch (judgeErr: any) {
      console.warn("LLM Judge call fallback:", judgeErr?.message);
    }

    // Heuristic Fallback (e.g. offline testing or when OpenRouter is unavailable)
    const normResp = trimmedResponse.toLowerCase().replace(/[^a-z0-9]/g, " ");
    const normExp = trimmedExpected.toLowerCase().replace(/[^a-z0-9]/g, " ");

    const expWords = normExp.split(/\s+/).filter((w) => w.length > 2);
    const matchedWords = expWords.filter((w) => normResp.includes(w));
    const coverage = expWords.length > 0 ? matchedWords.length / expWords.length : 0;

    const isMatch = coverage >= 0.75 || normResp.includes(normExp) || normExp.includes(normResp);
    const score = isMatch ? Math.max(0.8, coverage) : coverage * 0.5;

    return {
      isCorrect: isMatch,
      score: Math.round(score * 100) / 100,
      reasoning: `[Rubric Heuristic] Answer token overlap coverage: ${(coverage * 100).toFixed(0)}%.`,
      metadata: { fallback: true, coverage },
    };
  }
}
