import { Scorer, ScoringResult } from "../types";

export class NormalizedMatchScorer implements Scorer {
  name = "normalized_match";

  score(response: string, expected: string, metadata?: any): ScoringResult {
    const cleanExpected = this.cleanNumber(expected);

    const gsmMatch = response.match(/####\s*(-?[0-9.,]+)/);
    if (gsmMatch && gsmMatch[1]) {
      const parsedGsm = this.cleanNumber(gsmMatch[1]);
      if (parsedGsm === cleanExpected) {
        return {
          isCorrect: true,
          score: 1.0,
          reasoning: "Extracted " + parsedGsm + " from final delimiter matching expected " + cleanExpected + ".",
        };
      }
    }

    const boxedMatch = response.match(/\\boxed\{([^}]+)\}/);
    if (boxedMatch && boxedMatch[1]) {
      const parsedBoxed = this.cleanNumber(boxedMatch[1]);
      if (parsedBoxed === cleanExpected) {
        return {
          isCorrect: true,
          score: 1.0,
          reasoning: "Extracted " + parsedBoxed + " from LaTeX boxed block matching expected.",
        };
      }
    }

    const allNumbers = response.match(/-?\d+(?:,\d+)*(?:\.\d+)?/g);
    if (allNumbers && allNumbers.length > 0) {
      const lastNumber = this.cleanNumber(allNumbers[allNumbers.length - 1]);
      if (lastNumber === cleanExpected) {
        return {
          isCorrect: true,
          score: 1.0,
          reasoning: "Final derived number " + lastNumber + " matches expected " + cleanExpected + ".",
        };
      }
    }

    return {
      isCorrect: false,
      score: 0.0,
      reasoning: "Output does not contain numerical answer " + cleanExpected + ".",
    };
  }

  private cleanNumber(str: string): string {
    return str.replace(/[$,]/g, "").trim().replace(/\.$/, "");
  }
}
