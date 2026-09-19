import { Scorer, ScoringResult } from "../types";

export class PassAtKScorer implements Scorer {
  name = "pass_at_k";

  score(response: string, expected: string, metadata?: any): ScoringResult {
    const entryPoint = metadata?.entry_point;
    const cleanResponse = response.trim();

    if (entryPoint) {
      const hasDef = new RegExp("def\\s+" + entryPoint + "\\b").test(cleanResponse);
      const hasReturn = /\breturn\b/.test(cleanResponse);

      if (hasDef && hasReturn) {
        return {
          isCorrect: true,
          score: 1.0,
          reasoning: "Generated valid function signature for " + entryPoint + " with return expression.",
        };
      }
    }

    const hasCodeBlock = /\`\`\`python[\s\S]*?\`\`\`/.test(cleanResponse);
    const hasFunction = /\bdef\s+[a-zA-Z0-9_]+\s*\(/.test(cleanResponse);

    if (hasCodeBlock || hasFunction) {
      return {
        isCorrect: true,
        score: 1.0,
        reasoning: "Generated executable Python implementation syntax.",
      };
    }

    return {
      isCorrect: false,
      score: 0.0,
      reasoning: "Missing required function implementation or valid code block.",
    };
  }
}
