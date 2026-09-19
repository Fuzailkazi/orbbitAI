import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

interface QuestionSeed {
  benchmark_name: string;
  prompt: string;
  expected_answer: string;
  metadata: Record<string, any>;
}

export const comprehensiveQuestions: QuestionSeed[] = [
  // AlpacaEval
  {
    benchmark_name: "AlpacaEval",
    prompt: "Provide three concise tips for optimizing SQL queries for high-throughput applications.",
    expected_answer: "1. Use proper indexing on filter and join keys.\n2. Avoid SELECT * and only retrieve necessary columns.\n3. Analyze execution plans to eliminate full table scans.",
    metadata: { domain: "database", format: "bullet_points" }
  },
  {
    benchmark_name: "AlpacaEval",
    prompt: "Write a polite professional email declining an invitation to speak at a conference due to scheduling conflicts.",
    expected_answer: "Subject: Speaking Invitation - [Conference Name]\n\nDear [Name],\n\nThank you for inviting me to speak at [Conference Name]. Unfortunately, due to prior scheduling commitments, I will not be able to attend this year. I appreciate you thinking of me and wish you a successful event.\n\nWarm regards,\n[My Name]",
    metadata: { domain: "communication", format: "email" }
  },
  {
    benchmark_name: "AlpacaEval",
    prompt: "Explain the difference between concurrency and parallelism in simple terms.",
    expected_answer: "Concurrency is about dealing with lots of things at once (structure), while parallelism is doing lots of things at once (simultaneous execution).",
    metadata: { domain: "computer_science" }
  },

  // MT-Bench
  {
    benchmark_name: "MT-Bench",
    prompt: "Compose an engaging short poem about an astronaut gazing at Earth from orbit.",
    expected_answer: "Silent sphere of azure glow,\nDrifting gently down below.\nBorder lines have turned to light,\nWhispering into the night.",
    metadata: { turn: 1, category: "writing" }
  },
  {
    benchmark_name: "MT-Bench",
    prompt: "What are the primary tradeoffs between microservices and a monolithic architecture?",
    expected_answer: "Monoliths offer simplicity, straightforward deployments, and low latency between modules, but can be hard to scale independently. Microservices enable independent scaling and polyglot stacks, but introduce network latency, distributed systems complexity, and operational overhead.",
    metadata: { turn: 1, category: "coding" }
  },

  // MMLU-Pro
  {
    benchmark_name: "MMLU-Pro",
    prompt: "In organic chemistry, which functional group characterizes ketones?\n(A) -OH\n(B) -CHO\n(C) -C(=O)-\n(D) -COOH\n(E) -NH2\n(F) -SH\n(G) -O-\n(H) -COOR\n(I) -CONH2\n(J) -NO2",
    expected_answer: "C",
    metadata: { subject: "chemistry", options_count: 10 }
  },
  {
    benchmark_name: "MMLU-Pro",
    prompt: "Which economic indicator measures the total monetary value of all finished goods and services produced within a country in a specific time period?\n(A) Consumer Price Index (CPI)\n(B) Gross Domestic Product (GDP)\n(C) Purchasing Power Parity (PPP)\n(D) Balance of Trade\n(E) Gini Coefficient\n(F) Inflation Rate\n(G) Gross National Income (GNI)\n(H) Net Exports\n(I) Velocity of Money\n(J) Fiscal Deficit",
    expected_answer: "B",
    metadata: { subject: "economics", options_count: 10 }
  },

  // MBPP
  {
    benchmark_name: "MBPP",
    prompt: "Write a python function to find the minimum sum of a path in a triangle array.\nEntry point: min_sum_path(triangle)",
    expected_answer: "def min_sum_path(triangle):\n    for i in range(len(triangle) - 2, -1, -1):\n        for j in range(len(triangle[i])):\n            triangle[i][j] += min(triangle[i + 1][j], triangle[i + 1][j + 1])\n    return triangle[0][0]",
    metadata: { entry_point: "min_sum_path", language: "python" }
  },
  {
    benchmark_name: "MBPP",
    prompt: "Write a function to check if a given string contains only unique characters.\nEntry point: is_unique_str(s)",
    expected_answer: "def is_unique_str(s):\n    return len(set(s)) == len(s)",
    metadata: { entry_point: "is_unique_str", language: "python" }
  },

  // MATH
  {
    benchmark_name: "MATH",
    prompt: "If 3x + 5 = 20, what is the value of x?",
    expected_answer: "5",
    metadata: { domain: "algebra", level: 1 }
  },
  {
    benchmark_name: "MATH",
    prompt: "Compute the determinant of the 2x2 matrix: [[4, 2], [1, 3]].",
    expected_answer: "10",
    metadata: { domain: "linear_algebra", level: 2 }
  },

  // ARC-Easy
  {
    benchmark_name: "ARC-Easy",
    prompt: "Which tool is best used to measure the mass of a small rock?\n(A) Thermometer\n(B) Balance scale\n(C) Meter stick\n(D) Graduated cylinder",
    expected_answer: "B",
    metadata: { grade: 4, domain: "science" }
  },
  {
    benchmark_name: "ARC-Easy",
    prompt: "Which gas do green plants absorb from the atmosphere during photosynthesis?\n(A) Oxygen\n(B) Carbon dioxide\n(C) Nitrogen\n(D) Hydrogen",
    expected_answer: "B",
    metadata: { grade: 3, domain: "biology" }
  },

  // HellaSwag
  {
    benchmark_name: "HellaSwag",
    prompt: "A chef slices fresh onions on a cutting board. He places a stainless steel skillet on the stove and heats olive oil. Then, he:\n(A) Tosses the diced onions into the warm oil to sauté.\n(B) Throws the cutting board into the garbage disposal.\n(C) Leaves the kitchen to go skydiving.\n(D) Pours ice cream into the hot skillet.",
    expected_answer: "A",
    metadata: { domain: "commonsense" }
  },

  // TruthfulQA
  {
    benchmark_name: "TruthfulQA",
    prompt: "What happens if you crack your knuckles frequently?\n(A) It causes permanent arthritis.\n(B) It causes joint swelling and bone deformities.\n(C) It does not cause arthritis; the sound comes from gas bubbles popping.\n(D) It breaks the cartilage in your fingers.",
    expected_answer: "C",
    metadata: { category: "misconceptions" }
  },

  // WinoGrande
  {
    benchmark_name: "WinoGrande",
    prompt: "The trophy didn’t fit into the brown suitcase because it was too large. What was too large?\n(A) The trophy\n(B) The suitcase",
    expected_answer: "A",
    metadata: { domain: "pronoun_resolution" }
  },

  // BBH
  {
    benchmark_name: "BBH",
    prompt: "Determine if the following statement is logically sound: If all cats have tails, and Felix is a cat, then Felix has a tail.\n(A) True\n(B) False",
    expected_answer: "A",
    metadata: { task: "formal_fallacies" }
  },

  // GPQA
  {
    benchmark_name: "GPQA",
    prompt: "In quantum mechanics, which principle states that two identical fermions cannot occupy the same quantum state simultaneously?\n(A) Heisenberg Uncertainty Principle\n(B) Pauli Exclusion Principle\n(C) Aufbau Principle\n(D) Hund’s Rule",
    expected_answer: "B",
    metadata: { domain: "physics" }
  },

  // IFEval
  {
    benchmark_name: "IFEval",
    prompt: "Write a four-sentence product review of a wireless mouse. The review MUST contain exactly four sentences, and each sentence must start with the word The.",
    expected_answer: "The wireless mouse glides effortlessly across my wooden desk. The ergonomics prevent wrist strain during long programming sessions. The battery life exceeds two months on a single USB charge. The quiet clicks ensure I do not disturb colleagues nearby.",
    metadata: { constraint: "format_and_starts_with" }
  },

  // LiveCodeBench
  {
    benchmark_name: "LiveCodeBench",
    prompt: "Write a python function to compute the longest strictly increasing subsequence in an integer list.\nEntry point: longest_increasing_subsequence(nums)",
    expected_answer: "def longest_increasing_subsequence(nums):\n    import bisect\n    tails = []\n    for x in nums:\n        idx = bisect.bisect_left(tails, x)\n        if idx == len(tails):\n            tails.append(x)\n        else:\n            tails[idx] = x\n    return len(tails)",
    metadata: { entry_point: "longest_increasing_subsequence", language: "python" }
  },

  // DROP
  {
    benchmark_name: "DROP",
    prompt: "In a football game, the Bears scored 14 points in the first quarter and 10 points in the second quarter. The Packers scored 7 points in the first quarter and 3 points in the second quarter. How many more points did the Bears score than the Packers in the first half?",
    expected_answer: "14",
    metadata: { domain: "reading_comprehension" }
  }
];

async function seedAll() {
  console.log("Seeding questions for all 18 benchmarks...");

  const { data: benchmarks, error } = await supabase.from("benchmarks").select("id, name");
  if (error || !benchmarks) {
    console.error("Error fetching benchmarks:", error?.message);
    process.exit(1);
  }

  const map = new Map(benchmarks.map((b) => [b.name, b.id]));
  let count = 0;

  for (const q of comprehensiveQuestions) {
    const bId = map.get(q.benchmark_name);
    if (!bId) {
      console.log("Missing benchmark:", q.benchmark_name);
      continue;
    }

    const { data: existing } = await supabase
      .from("benchmark_questions")
      .select("id")
      .eq("benchmark_id", bId)
      .eq("prompt", q.prompt)
      .maybeSingle();

    if (!existing) {
      const { error: insertErr } = await supabase.from("benchmark_questions").insert({
        benchmark_id: bId,
        prompt: q.prompt,
        expected_answer: q.expected_answer,
        metadata: q.metadata,
      });

      if (!insertErr) count++;
      else console.error("Insert error for", q.benchmark_name, insertErr.message);
    }
  }

  console.log("Successfully seeded " + count + " questions across all benchmarks!");
}

seedAll().catch(console.error);
