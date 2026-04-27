export interface SpaceSeed {
  name: string;
  description: string;
  icon: string;
  benchmark_names: string[]; // resolved to IDs at seed time
}

export const spaces: SpaceSeed[] = [
  {
    name: "Mathematics",
    description: "Mathematical reasoning from grade school arithmetic to competition-level problems.",
    icon: "calculator",
    benchmark_names: ["GSM8K", "MATH"],
  },
  {
    name: "Code Generation",
    description: "Functional code generation across Python and multiple languages.",
    icon: "code",
    benchmark_names: ["HumanEval", "MBPP", "LiveCodeBench"],
  },
  {
    name: "Reasoning",
    description: "Logical reasoning, commonsense inference, and complex problem-solving.",
    icon: "brain",
    benchmark_names: ["ARC-Challenge", "HellaSwag", "WinoGrande", "BBH", "DROP"],
  },
  {
    name: "Chat Quality",
    description: "Open-ended conversation, instruction following, and response quality.",
    icon: "message-circle",
    benchmark_names: ["MT-Bench", "AlpacaEval", "IFEval"],
  },
  {
    name: "Factuality",
    description: "Truthfulness, factual accuracy, and resistance to common misconceptions.",
    icon: "check-circle",
    benchmark_names: ["TruthfulQA", "GPQA"],
  },
  {
    name: "Agentic",
    description: "Multi-step reasoning, tool use, and complex task completion.",
    icon: "bot",
    benchmark_names: ["BBH", "MMLU-Pro", "DROP"],
  },
];
