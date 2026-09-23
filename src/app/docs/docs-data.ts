/** Static documentation outline shared by the server-rendered page and its client nav islands. */

export interface DocsSection {
  id: string;
  title: string;
  category: string;
}

export const SECTIONS: readonly DocsSection[] = [
  { id: "overview", title: "1. Overview & Philosophy", category: "Getting Started" },
  { id: "quickstart", title: "2. Quick Start Guide", category: "Getting Started" },
  { id: "evaluations", title: "3. Evaluation Workflows", category: "Platform Guides" },
  { id: "scorers", title: "4. Scoring Engines", category: "Platform Guides" },
  { id: "spaces", title: "5. Spaces", category: "Platform Guides" },
  { id: "statistical-rigor", title: "6. Wilson 95% Confidence", category: "Mathematics" },
  { id: "value-score", title: "7. Dynamic Value Score™", category: "Mathematics" },
  { id: "byod", title: "8. Custom Datasets (BYOD)", category: "Developer Guides" },
  { id: "openrouter", title: "9. OpenRouter & Model Sync", category: "Developer Guides" },
];

export const CATEGORIES = ["Getting Started", "Platform Guides", "Mathematics", "Developer Guides"] as const;

export const JSON_SNIPPET = `[
  {
    "prompt": "What is the capital of Australia? A) Sydney B) Melbourne C) Canberra D) Perth",
    "expected_answer": "C"
  },
  {
    "prompt": "Calculate a 15% tip on an $80 bill.",
    "expected_answer": "12"
  }
]`;
