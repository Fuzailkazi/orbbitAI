# Orbbit — Project Context for Claude Code

## What Is This?

Orbbit is an independent AI model evaluation & benchmarking platform. It lets users browse 175+ AI models, run standardized benchmarks, compare models side-by-side on accuracy/latency/cost, and rank them with user-adjustable weights.

See `PROBLEM_STATEMENT.md` for the full problem/solution breakdown.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19.2, TypeScript
- **Styling:** Tailwind CSS + shadcn/ui components
- **Font:** Proxima Nova (primary), JetBrains Mono (monospace)
- **Charts:** Recharts
- **Database:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **Job Queue:** Inngest (serverless async eval jobs)
- **AI Model Access:** OpenRouter (single API for 200+ models)
- **Hosting:** Vercel
- **Package Manager:** pnpm

## Project Structure

```
orbbit/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Auth pages (login, signup)
│   │   ├── (dashboard)/        # Protected dashboard routes
│   │   │   ├── models/         # Model catalog
│   │   │   ├── compare/        # Side-by-side comparison
│   │   │   ├── leaderboard/    # Dynamic leaderboard
│   │   │   ├── spaces/         # Evaluation spaces
│   │   │   └── evaluations/    # Evaluation runs & results
│   │   ├── api/                # API routes
│   │   ├── layout.tsx
│   │   └── page.tsx            # Landing page
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── charts/             # Recharts wrappers
│   │   ├── models/             # Model-specific components
│   │   ├── evaluations/        # Eval-specific components
│   │   └── layout/             # Shell, nav, sidebar
│   ├── lib/
│   │   ├── supabase/           # Supabase client & helpers
│   │   ├── eval/               # Evaluation engine & scoring
│   │   ├── openrouter/         # OpenRouter API client
│   │   └── utils/              # Shared utilities
│   ├── types/                  # TypeScript type definitions
│   └── hooks/                  # Custom React hooks
├── supabase/
│   ├── migrations/             # SQL migration files
│   └── seed.sql                # Seed data (models, benchmarks)
├── inngest/                    # Inngest function definitions
├── public/                     # Static assets
├── PROBLEM_STATEMENT.md
├── CLAUDE.md
└── GEMINI.md
```

## Key Commands

```bash
pnpm dev              # Start dev server (localhost:3000)
pnpm build            # Production build
pnpm lint             # ESLint
pnpm type-check       # TypeScript check
pnpm db:migrate       # Run Supabase migrations
pnpm db:seed          # Seed database
pnpm db:reset         # Reset database
pnpm db:types         # Generate TypeScript types from Supabase schema
```

## Coding Conventions

### General
- TypeScript strict mode — no `any` types unless absolutely unavoidable
- Use named exports, not default exports (except for Next.js pages)
- Prefer `async/await` over `.then()` chains
- Use early returns to reduce nesting
- All files use `.ts` / `.tsx` extensions
- **No Python** — the entire project is TypeScript/JavaScript only

### Naming
- Components: `PascalCase` (e.g., `ModelCard.tsx`)
- Hooks: `camelCase` with `use` prefix (e.g., `useModels.ts`)
- Utils/lib: `camelCase` (e.g., `calculateAccuracy.ts`)
- Types: `PascalCase` with descriptive names (e.g., `EvaluationResult`)
- Database tables: `snake_case`
- API routes: `kebab-case` URLs

### Components
- Use server components by default, `"use client"` only when needed
- Keep components focused — one responsibility per file
- Co-locate component-specific types in the same file
- Use shadcn/ui primitives, don't reinvent UI elements

### Database
- All tables use UUIDs as primary keys
- Always use RLS policies — no public access without auth
- Use `created_at` and `updated_at` timestamps on all tables
- Foreign keys with cascading deletes where appropriate

### State Management
- Server state: React Server Components + Supabase queries
- Client state: React hooks (`useState`, `useReducer`)
- URL state: `nuqs` or Next.js `searchParams` for filters/sorting
- No Redux or Zustand — keep it simple

### Next.js 16 Patterns
- Use `"use cache"` directive for cacheable components (model catalog, benchmark lists, leaderboard)
- Use `proxy.ts` instead of `middleware.ts` for auth guards and routing
- React Compiler is enabled — do NOT manually use `useMemo`, `useCallback`, or `React.memo`
- Use View Transitions for page navigation animations
- Turbopack is the default bundler — no Webpack config needed

## Important Patterns

### Evaluation Scoring
All scoring functions live in `src/lib/eval/scorers/`. Each scorer implements:
```typescript
interface Scorer {
  name: string;
  score(response: string, expected: string, metadata?: any): ScoringResult;
}

interface ScoringResult {
  isCorrect: boolean;
  score: number;       // 0-1 normalized
  reasoning?: string;  // For LLM-as-Judge
  metadata?: Record<string, any>;
}
```

### Supabase Client
- Server components: use `createServerClient()` from `src/lib/supabase/server.ts`
- Client components: use `createBrowserClient()` from `src/lib/supabase/client.ts`
- API routes: use `createRouteHandlerClient()` from `src/lib/supabase/route.ts`
- Never expose the service role key on the client

### Error Handling
- API routes: always return typed error responses `{ error: string, code: string }`
- Use Supabase error codes, don't swallow errors silently
- Client-side: use toast notifications for user-facing errors

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenRouter
OPENROUTER_API_KEY=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Guest demo (HMAC secret for the signed guest cookie; falls back to a key derived from SUPABASE_SERVICE_ROLE_KEY)
GUEST_DEMO_SECRET=
```

## Data Schemas

### Core Entities (TypeScript)

```typescript
// === MODELS ===
interface Model {
  id: string;                    // UUID
  name: string;                  // "GPT-4o"
  vendor: string;                // "OpenAI"
  category: ModelCategory;
  context_window: number;        // 128000
  pricing_input: number;         // $/1M input tokens
  pricing_output: number;        // $/1M output tokens
  api_identifier: string;        // "openai/gpt-4o" (OpenRouter format)
  release_date: string;          // ISO date
  is_active: boolean;
  description?: string;
  tags: string[];                // ["chat", "vision", "reasoning"]
  created_at: string;
  updated_at: string;
}

type ModelCategory = "chat" | "reasoning" | "code" | "vision" | "embedding" | "moe" | "transformer";

// === BENCHMARKS ===
interface Benchmark {
  id: string;
  name: string;                  // "MMLU"
  description: string;
  category: BenchmarkCategory;
  scoring_method: ScoringMethod;
  total_questions: number;
  source_url?: string;
  created_at: string;
}

type BenchmarkCategory = "reasoning" | "math" | "code" | "chat" | "factuality" | "science" | "general" | "agentic";
type ScoringMethod = "exact_match" | "normalized_match" | "pass_at_k" | "llm_judge" | "bleu" | "rouge";

// === EVALUATIONS ===
interface Evaluation {
  id: string;
  model_id: string;
  benchmark_id: string;
  status: EvaluationStatus;
  accuracy: number | null;       // 0-100 percentage
  accuracy_ci_lower: number | null;  // Wilson CI lower bound
  accuracy_ci_upper: number | null;  // Wilson CI upper bound
  avg_latency_ms: number | null;
  median_latency_ms: number | null;
  p95_latency_ms: number | null;
  total_tokens: number | null;
  total_cost: number | null;     // USD
  failure_rate: number | null;   // 0-100 percentage
  tokens_per_second: number | null;
  questions_evaluated: number;
  questions_correct: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

type EvaluationStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

// === PER-PROMPT RESULTS ===
interface EvaluationResult {
  id: string;
  evaluation_id: string;
  question_id: string;
  model_response: string;
  is_correct: boolean;
  score: number;                 // 0-1 normalized
  latency_ms: number;
  tokens_used: number;
  time_to_first_token_ms: number | null;
  judge_reasoning?: string;
  created_at: string;
}

// === SPACES ===
interface Space {
  id: string;
  name: string;                  // "Mathematics"
  description: string;
  icon: string;
  benchmark_ids: string[];
  created_at: string;
}

// === VALUE SCORE ===
interface ValueScoreWeights {
  quality: number;               // 0-1, default 0.5
  cost: number;                  // 0-1, default 0.25
  speed: number;                 // 0-1, default 0.25
}

interface ValueScore {
  model_id: string;
  composite_score: number;       // 0-100
  quality_normalized: number;    // 0-1
  cost_normalized: number;       // 0-1 (inverted — lower cost = higher score)
  speed_normalized: number;      // 0-1 (inverted — lower latency = higher score)
  weights_used: ValueScoreWeights;
}
```

### Database → TypeScript Mapping

| DB Column (snake_case) | TS Property (camelCase) | Auto-generated |
|------------------------|------------------------|----------------|
| `created_at` | `created_at` | Keep snake_case (Supabase convention) |
| `model_id` | `model_id` | Keep snake_case (Supabase convention) |
| All columns | Match DB exactly | Use `pnpm db:types` to generate |

> **Rule:** TypeScript types for database rows use snake_case to match Supabase's generated types exactly. Don't create a camelCase wrapper — it causes bugs.

---

## Behavioral Rules

> These rules govern how all code in this project must behave. Both Antigravity and Claude Code must follow them.

1. **Every accuracy score must include a confidence interval.** Never display a raw percentage without Wilson CI bounds. A score without a CI is a lie.

2. **Every evaluation result must be traceable to the prompt level.** Users must be able to click any aggregate score and drill down to see which exact questions were answered correctly/incorrectly.

3. **All model API calls go through OpenRouter.** Never call provider APIs directly (no `openai` SDK, no `@anthropic-ai/sdk`). OpenRouter is the single integration point.

4. **All database queries respect RLS.** No `service_role` key usage in client-facing code. Server components use `createServerClient()`, client components use `createBrowserClient()`. The only exception is seeding scripts.

5. **Scores are immutable once an evaluation completes.** Never update accuracy/latency/cost on a completed evaluation. If a re-evaluation is needed, create a new evaluation record.

6. **The Value Score formula must always use user-adjustable weights.** Default weights are quality=0.5, cost=0.25, speed=0.25, but users can always change them. Never hardcode a single composite formula.

7. **All costs are calculated, never estimated.** Track actual `input_tokens` and `output_tokens` from the API response and multiply by the model's known pricing. Don't estimate from prompt length.

8. **Evaluations run asynchronously.** Never block the UI waiting for model responses. All evaluations go through the job queue (Inngest). The UI polls or subscribes for updates.

9. **Failed prompts are recorded, not retried silently.** If a model API call fails, record the failure with the error message. Don't retry and hide the failure — failure rate is a metric.

10. **One scorer per benchmark, declared in the benchmark config.** The scoring method is a property of the benchmark, not a runtime choice. MMLU = exact_match. HumanEval = pass_at_k. MT-Bench = llm_judge.

11. **Light mode is the default.** The product ships a clean light theme. All colors come from the semantic tokens in `src/app/globals.css` (`bg-background`, `text-muted-foreground`, `border-border`, `text-success`, etc.) — never hardcode palette classes like `bg-white`/`text-slate-500` or hex values in components. The `.dark` token set is kept in sync so a dark toggle stays possible, but design and test light-first.

---

## Architectural Invariants

> These are guarantees about the system architecture that must never be violated.

### 1. Data Flow
```
User Action → API Route / Server Action → Supabase (RLS enforced) → Response
                                        ↘ Inngest Queue (for async eval jobs)
```
No component ever talks to OpenRouter directly. No client component ever talks to Supabase with the service role key.

### 2. Scoring Pipeline
```
Benchmark config declares scoring_method →
  Scorer factory returns the correct scorer →
    Scorer.score(response, expected) →
      Returns { isCorrect, score, reasoning }
```
New scoring methods are added by creating a new scorer in `src/lib/eval/scorers/` and registering it in the factory. No `if/else` chains for scoring logic.

### 3. Component Hierarchy
```
layout.tsx (shell, nav, auth check)
  └── page.tsx (server component — fetches data)
       └── ClientComponent (interactive parts only)
            └── shadcn/ui primitives
```
Data fetching happens in server components. Client components receive data as props. No `useEffect` for data fetching.

### 4. Auth Boundary
```
proxy.ts guards all /dashboard/* routes →
  Redirects unauthenticated users to /login →
    After auth, Supabase RLS ensures data isolation
```
Auth is enforced at two layers: routing (proxy.ts) and data (RLS). Never rely on only one.

### 5. URL as Source of Truth
All filterable/sortable views (model catalog, leaderboard, comparison) store their state in URL search params. This means:
- Shareable URLs (send someone your filtered view)
- Browser back/forward works
- No state management library needed

### 6. Caching Strategy
```
"use cache" on: model catalog, benchmark list, leaderboard (revalidate every 5 min)
No cache on:    evaluation results (always fresh), user-specific data
Revalidate on:  new evaluation completes → revalidateTag("evaluations")
```

### 7. Error Boundaries
Every page has an `error.tsx` and `loading.tsx`. Every async operation has error handling. No unhandled promise rejections.

### 8. Type Safety Chain
```
Supabase schema → pnpm db:types → src/types/database.ts → used everywhere
```
All database types are auto-generated. Manual type definitions are only for app-level concepts (ValueScore, etc.) that don't map 1:1 to a table.

---

## Project Memory Files

| File | Purpose | Update Frequency |
|------|---------|-----------------|
| `CLAUDE.md` | Project constitution — schemas, rules, invariants | When architecture changes |
| `GEMINI.md` | Antigravity-specific instructions | When tooling changes |
| `PROBLEM_STATEMENT.md` | What we're building and why | Rarely |
| `task_plan.md` | Phases, goals, checklists | Every work session |
| `findings.md` | Research, discoveries, constraints | When new info is found |
| `progress.md` | What was done, errors, tests, results | After every work block |

---

## What NOT To Do

- Don't use `pages/` router — this is App Router only
- Don't install state management libraries (Redux, Zustand, Jotai)
- Don't use CSS modules or styled-components — Tailwind only
- Don't skip TypeScript types — no `any` or `// @ts-ignore`
- Don't make Supabase queries without RLS policies
- Don't store API keys in client-side code
- Don't create custom UI components when shadcn/ui has one
- Don't display accuracy without confidence intervals
- Don't retry failed API calls silently — record the failure
- Don't use `useMemo`, `useCallback`, `React.memo` — React Compiler handles this
- Don't use `middleware.ts` — use `proxy.ts` (Next.js 16)
- Don't fetch data in `useEffect` — use server components
- Don't use paid OpenRouter models — exclusively use `:free` tier models (e.g. `*:free`) for live evaluations to maintain 100% free usage

