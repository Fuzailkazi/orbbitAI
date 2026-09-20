export interface ScoringResult {
  isCorrect: boolean;
  score: number; // 0.0 to 1.0 normalized
  reasoning?: string;
  metadata?: Record<string, any>;
}

export interface Scorer {
  name: string;
  score(response: string, expected: string, metadata?: any): ScoringResult | Promise<ScoringResult>;
}
