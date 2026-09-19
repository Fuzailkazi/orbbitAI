import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

interface BenchmarkQuestionSeed {
  benchmark_name: string;
  prompt: string;
  expected_answer: string;
  metadata: Record<string, any>;
}

export const sampleQuestions: BenchmarkQuestionSeed[] = [
  // MMLU
  {
    benchmark_name: "MMLU",
    prompt: "What is the capital of Australia?\n(A) Sydney\n(B) Melbourne\n(C) Canberra\n(D) Brisbane",
    expected_answer: "C",
    metadata: { subject: "geography", difficulty: "easy" },
  },
  {
    benchmark_name: "MMLU",
    prompt: "Which of the following sorting algorithms has the best worst-case time complexity?\n(A) Quick Sort\n(B) Merge Sort\n(C) Bubble Sort\n(D) Insertion Sort",
    expected_answer: "B",
    metadata: { subject: "computer_science", difficulty: "medium" },
  },
  {
    benchmark_name: "MMLU",
    prompt: "Which hormone regulates blood sugar by facilitating cellular uptake of glucose?\n(A) Glucagon\n(B) Insulin\n(C) Cortisol\n(D) Thyroxine",
    expected_answer: "B",
    metadata: { subject: "biology", difficulty: "medium" },
  },
  {
    benchmark_name: "MMLU",
    prompt: "In contract law, what is the term for an exchange of promises where both parties make commitments?\n(A) Unilateral contract\n(B) Bilateral contract\n(C) Executed contract\n(D) Quasi-contract",
    expected_answer: "B",
    metadata: { subject: "law", difficulty: "hard" },
  },
  // GSM8K
  {
    benchmark_name: "GSM8K",
    prompt: "Janet’s ducks lay 16 eggs per day. She eats three for breakfast every morning and bakes muffins for her friends every day with four. She sells the remainder at the farmers market daily for $2 per fresh duck egg. How much in dollars does she make every day at the farmers market?",
    expected_answer: "18",
    metadata: { steps: 3, domain: "arithmetic" },
  },
  {
    benchmark_name: "GSM8K",
    prompt: "A robe takes 2 bolts of blue fiber and half that much white fiber. How many bolts in total does it take to make 4 identical robes?",
    expected_answer: "12",
    metadata: { steps: 2, domain: "arithmetic" },
  },
  {
    benchmark_name: "GSM8K",
    prompt: "Josh decides to try flipping a house. He buys a house for $80,000 and spends $50,000 on repairs. He then sells the house for $150,000. How much profit did he make in dollars?",
    expected_answer: "20000",
    metadata: { steps: 2, domain: "arithmetic" },
  },
  {
    benchmark_name: "GSM8K",
    prompt: "James buys 5 packs of baseball cards with 20 cards each. He gives 25 cards to his brother and trades 15 cards for 1 special card. How many total cards does he have now?",
    expected_answer: "61",
    metadata: { steps: 3, domain: "arithmetic" },
  },
  // ARC-Challenge
  {
    benchmark_name: "ARC-Challenge",
    prompt: "Which statement explains why the Sun appears larger and brighter than other stars in the sky?\n(A) The Sun produces significantly more energy than any other star.\n(B) The Sun is much closer to Earth than any other star.\n(C) The Sun is larger in actual diameter than any known star.\n(D) Light travels faster from the Sun than from distant stars.",
    expected_answer: "B",
    metadata: { grade: 5, domain: "astronomy" },
  },
  {
    benchmark_name: "ARC-Challenge",
    prompt: "An engineer wants to test how temperature affects the resistance of copper wire. Which variable should be kept constant?\n(A) Wire temperature\n(B) Length and thickness of the wire\n(C) Measured electrical resistance\n(D) Cooling method",
    expected_answer: "B",
    metadata: { grade: 8, domain: "physics" },
  },
  {
    benchmark_name: "ARC-Challenge",
    prompt: "Which environmental factor directly influences natural selection in a population of peppered moths?\n(A) Soil composition\n(B) Tree bark color\n(C) Atmospheric pressure\n(D) Water pH",
    expected_answer: "B",
    metadata: { grade: 8, domain: "biology" },
  },
  // HumanEval
  {
    benchmark_name: "HumanEval",
    prompt: "def has_close_elements(numbers: list[float], threshold: float) -> bool:\n    \"\"\" Check if in given list of numbers, are any two numbers closer to each other than given threshold.\n    >>> has_close_elements([1.0, 2.0, 3.9, 4.0, 5.0, 2.2], 0.3)\n    True\n    \"\"\"",
    expected_answer: "def has_close_elements(numbers: list[float], threshold: float) -> bool:\n    for idx, elem in enumerate(numbers):\n        for idx2, elem2 in enumerate(numbers):\n            if idx != idx2:\n                if abs(elem - elem2) < threshold:\n                    return True\n    return False",
    metadata: { language: "python", entry_point: "has_close_elements" },
  },
  {
    benchmark_name: "HumanEval",
    prompt: "def truncate_number(number: float) -> float:\n    \"\"\" Given a positive floating point number, return the decimal part of the number.\n    >>> truncate_number(3.5)\n    0.5\n    \"\"\"",
    expected_answer: "def truncate_number(number: float) -> float:\n    return number % 1.0",
    metadata: { language: "python", entry_point: "truncate_number" },
  },
];

async function main() {
  console.log("📝 Seeding benchmark questions and per-prompt results...\\n");

  const { data: benchmarks, error: bError } = await supabase
    .from("benchmarks")
    .select("id, name");

  if (bError || !benchmarks) {
    console.error("Failed to fetch benchmarks:", bError?.message);
    process.exit(1);
  }

  const benchMap = new Map(benchmarks.map((b) => [b.name, b.id]));
  const insertedQuestions: { id: string; benchmark_id: string; prompt: string; expected_answer: string }[] = [];

  for (const q of sampleQuestions) {
    const benchId = benchMap.get(q.benchmark_name);
    if (!benchId) continue;

    const { data: existing } = await supabase
      .from("benchmark_questions")
      .select("id")
      .eq("benchmark_id", benchId)
      .eq("prompt", q.prompt)
      .maybeSingle();

    if (existing) {
      insertedQuestions.push({
        id: existing.id,
        benchmark_id: benchId,
        prompt: q.prompt,
        expected_answer: q.expected_answer,
      });
      continue;
    }

    const { data: inserted, error: qError } = await supabase
      .from("benchmark_questions")
      .insert({
        benchmark_id: benchId,
        prompt: q.prompt,
        expected_answer: q.expected_answer,
        metadata: q.metadata,
      })
      .select("id, benchmark_id, prompt, expected_answer")
      .single();

    if (qError) {
      console.error("Error inserting question:", qError.message);
    } else if (inserted) {
      insertedQuestions.push(inserted);
    }
  }

  console.log("✓ " + insertedQuestions.length + " benchmark questions ready.");

  const { data: evals, error: evalError } = await supabase
    .from("evaluations")
    .select("id, model_id, benchmark_id, accuracy");

  if (evalError || !evals) {
    console.error("Failed to fetch evaluations:", evalError?.message);
    process.exit(1);
  }

  let totalResults = 0;

  for (const ev of evals) {
    const questionsForBench = insertedQuestions.filter((q) => q.benchmark_id === ev.benchmark_id);
    if (questionsForBench.length === 0) continue;

    for (let i = 0; i < questionsForBench.length; i++) {
      const q = questionsForBench[i];
      const threshold = (ev.accuracy ?? 75) / 100;
      const isCorrect = (i / questionsForBench.length) <= threshold;

      let modelResponse = q.expected_answer;
      if (!isCorrect) {
        if (q.expected_answer === "A") modelResponse = "B";
        else if (q.expected_answer === "B") modelResponse = "C";
        else if (q.expected_answer === "C") modelResponse = "A";
        else if (q.expected_answer === "18") modelResponse = "22";
        else if (q.expected_answer === "12") modelResponse = "16";
        else if (q.expected_answer === "20000") modelResponse = "30000";
        else modelResponse = "def solution():\n    return False";
      }

      const { data: existingResult } = await supabase
        .from("evaluation_results")
        .select("id")
        .eq("evaluation_id", ev.id)
        .eq("question_id", q.id)
        .maybeSingle();

      if (!existingResult) {
        const { error: resError } = await supabase
          .from("evaluation_results")
          .insert({
            evaluation_id: ev.id,
            question_id: q.id,
            model_response: modelResponse,
            is_correct: isCorrect,
            score: isCorrect ? 1.0 : 0.0,
            latency_ms: Math.floor(250 + Math.random() * 450),
            tokens_used: Math.floor(120 + Math.random() * 150),
            time_to_first_token_ms: Math.floor(100 + Math.random() * 150),
            judge_reasoning: isCorrect
              ? "Answer matches ground truth specification."
              : "Output does not match expected ground truth " + q.expected_answer + ".",
          });

        if (!resError) totalResults++;
      }
    }
  }

  console.log("✓ Seeded " + totalResults + " per-prompt evaluation results.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
