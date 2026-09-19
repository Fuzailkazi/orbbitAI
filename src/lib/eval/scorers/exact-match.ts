import { Scorer, ScoringResult } from "../types";

export class ExactMatchScorer implements Scorer {
  name = "exact_match";

  score(response: string, expected: string, metadata?: any): ScoringResult {
    const trimmedExpected = expected.trim().toUpperCase();
    const cleanResponse = response.trim();

    if (cleanResponse.toUpperCase() === trimmedExpected) {
      return {
        isCorrect: true,
        score: 1.0,
        reasoning: "Direct exact match for option " + trimmedExpected + ".",
      };
    }

    const patterns = [
      /answer(?:\s+is|:)?\s*\(?([A-D])\)?/i,
      /\b([A-D])\b(?=\s*(?:is the correct|is correct|option))/i,
      /\(([A-D])\)/i,
      /\*\*([A-D])\*\*/i,
      /(?:^|\s)([A-D])\./i,
      /(?:^|\s)choice\s*([A-D])/i,
    ];

    for (const pattern of patterns) {
      const match = cleanResponse.match(pattern);
      if (match && match[1]) {
        const extracted = match[1].toUpperCase();
        if (extracted === trimmedExpected) {
          return {
            isCorrect: true,
            score: 1.0,
            reasoning: "Extracted option " + extracted + " matches expected " + trimmedExpected + ".",
          };
        } else {
          return {
            isCorrect: false,
            score: 0.0,
            reasoning: "Extracted option " + extracted + " does not match expected " + trimmedExpected + ".",
          };
        }
      }
    }

    const firstChar = cleanResponse.charAt(0).toUpperCase();
    if (["A", "B", "C", "D"].includes(firstChar)) {
      const isCorrect = firstChar === trimmedExpected;
      return {
        isCorrect,
        score: isCorrect ? 1.0 : 0.0,
        reasoning: isCorrect
          ? "Leading character " + firstChar + " matches expected."
          : "Leading character " + firstChar + " does not match expected " + trimmedExpected + ".",
      };
    }

    return {
      isCorrect: false,
      score: 0.0,
      reasoning: "Could not extract valid multiple-choice answer matching " + trimmedExpected + ".",
    };
  }
}
