import type { BenchmarkCategory, ScoringMethod } from "../src/types/database";

export interface BenchmarkSeed {
  name: string;
  description: string;
  category: BenchmarkCategory;
  scoring_method: ScoringMethod;
  total_questions: number;
  source_url: string | null;
}

export const benchmarks: BenchmarkSeed[] = [
  {
    name: "MMLU",
    description: "Massive Multitask Language Understanding — 57 subjects from STEM, humanities, social sciences, and more. Tests breadth of world knowledge and problem-solving.",
    category: "general",
    scoring_method: "exact_match",
    total_questions: 14042,
    source_url: "https://huggingface.co/datasets/cais/mmlu",
  },
  {
    name: "MMLU-Pro",
    description: "Harder variant of MMLU with 10 answer choices instead of 4, more reasoning-focused questions, and reduced noise.",
    category: "reasoning",
    scoring_method: "exact_match",
    total_questions: 12032,
    source_url: "https://huggingface.co/datasets/TIGER-Lab/MMLU-Pro",
  },
  {
    name: "HumanEval",
    description: "164 hand-written Python programming problems with function signatures and docstrings. Tests functional code generation.",
    category: "code",
    scoring_method: "pass_at_k",
    total_questions: 164,
    source_url: "https://github.com/openai/human-eval",
  },
  {
    name: "MBPP",
    description: "Mostly Basic Python Programming — 974 crowd-sourced Python tasks with natural language descriptions, reference solutions, and test cases.",
    category: "code",
    scoring_method: "pass_at_k",
    total_questions: 974,
    source_url: "https://huggingface.co/datasets/google-research-datasets/mbpp",
  },
  {
    name: "GSM8K",
    description: "Grade School Math 8K — 8,792 grade school math word problems requiring multi-step reasoning with basic arithmetic.",
    category: "math",
    scoring_method: "normalized_match",
    total_questions: 8792,
    source_url: "https://huggingface.co/datasets/openai/gsm8k",
  },
  {
    name: "MATH",
    description: "12,500 competition-level math problems spanning algebra, geometry, number theory, counting, and probability.",
    category: "math",
    scoring_method: "normalized_match",
    total_questions: 12500,
    source_url: "https://huggingface.co/datasets/lighteval/MATH",
  },
  {
    name: "ARC-Challenge",
    description: "AI2 Reasoning Challenge (hard set) — 2,590 grade-school science questions that require reasoning beyond simple retrieval.",
    category: "reasoning",
    scoring_method: "exact_match",
    total_questions: 2590,
    source_url: "https://huggingface.co/datasets/allenai/ai2_arc",
  },
  {
    name: "ARC-Easy",
    description: "AI2 Reasoning Challenge (easy set) — 5,197 grade-school science questions answerable with simple retrieval or matching.",
    category: "science",
    scoring_method: "exact_match",
    total_questions: 5197,
    source_url: "https://huggingface.co/datasets/allenai/ai2_arc",
  },
  {
    name: "HellaSwag",
    description: "Evaluates commonsense natural language inference — given a scenario, select the most plausible continuation.",
    category: "reasoning",
    scoring_method: "exact_match",
    total_questions: 10042,
    source_url: "https://huggingface.co/datasets/Rowan/hellaswag",
  },
  {
    name: "TruthfulQA",
    description: "817 questions designed to test whether models generate truthful answers, avoiding common misconceptions and false claims.",
    category: "factuality",
    scoring_method: "exact_match",
    total_questions: 817,
    source_url: "https://huggingface.co/datasets/truthful_qa",
  },
  {
    name: "WinoGrande",
    description: "44,000 pronoun resolution problems requiring commonsense reasoning to determine the correct referent.",
    category: "reasoning",
    scoring_method: "exact_match",
    total_questions: 44000,
    source_url: "https://huggingface.co/datasets/allenai/winogrande",
  },
  {
    name: "MT-Bench",
    description: "Multi-turn benchmark with 80 high-quality questions across 8 categories. Uses GPT-4 as judge for scoring open-ended responses.",
    category: "chat",
    scoring_method: "llm_judge",
    total_questions: 80,
    source_url: "https://huggingface.co/datasets/lmsys/mt_bench_human_judgments",
  },
  {
    name: "AlpacaEval",
    description: "Automated evaluation of instruction-following ability. Compares model outputs against reference (GPT-4) using LLM-as-judge.",
    category: "chat",
    scoring_method: "llm_judge",
    total_questions: 805,
    source_url: "https://github.com/tatsu-lab/alpaca_eval",
  },
  {
    name: "BBH",
    description: "BIG-Bench Hard — 23 challenging tasks from BIG-Bench where prior language models failed to surpass average human performance.",
    category: "reasoning",
    scoring_method: "exact_match",
    total_questions: 6511,
    source_url: "https://huggingface.co/datasets/lukaemon/bbh",
  },
  {
    name: "GPQA",
    description: "Graduate-level Google-Proof Q&A — expert-crafted questions in biology, physics, and chemistry that are difficult even for domain experts.",
    category: "science",
    scoring_method: "exact_match",
    total_questions: 448,
    source_url: "https://huggingface.co/datasets/Idavidrein/gpqa",
  },
  {
    name: "IFEval",
    description: "Instruction Following Evaluation — tests whether models can precisely follow formatting, content, and structural constraints in instructions.",
    category: "chat",
    scoring_method: "exact_match",
    total_questions: 541,
    source_url: "https://huggingface.co/datasets/google/IFEval",
  },
  {
    name: "LiveCodeBench",
    description: "Continuously updated code generation benchmark from competitive programming platforms. Tests on problems released after model training cutoffs.",
    category: "code",
    scoring_method: "pass_at_k",
    total_questions: 880,
    source_url: "https://livecodebench.github.io/",
  },
  {
    name: "DROP",
    description: "Discrete Reasoning Over Paragraphs — reading comprehension requiring numerical reasoning, sorting, counting over text passages.",
    category: "reasoning",
    scoring_method: "normalized_match",
    total_questions: 9536,
    source_url: "https://huggingface.co/datasets/ucinlp/drop",
  },
];
