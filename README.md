# 🪐 Orbbit — AI Model Evaluation & Benchmarking Platform

> **"Don't guess which AI model to use. Prove it."**
> Independent, multi-dimensional AI model evaluation with prompt-level transparency, customizable Value Score rankings, and Wilson 95% confidence intervals.

[![Next.js](https://img.shields.io/badge/Next.js-16.2.4-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20RLS-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-400%2B%20Models-6366F1?style=flat-square)](https://openrouter.ai/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS%20v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## ⚡ The Problem: The AI Model Selection Crisis

Every week, frontier labs release new AI models — GPT-4o, Claude 3.5 Sonnet, Gemini 2.5, DeepSeek R1, Llama 3.3 — each claiming state-of-the-art (SOTA) performance. Yet, developers and engineering leaders face the same problem:

1. **Leaderboards Are Misleading**: Public benchmarks show a single aggregate score, but an academic knowledge test (MMLU) tells you nothing about SQL generation or RAG synthesis for your product.
2. **Missing the Full Picture**: Accuracy alone is insufficient. A model that is 2% more accurate but 4× slower and 5× more expensive is usually the wrong production choice.
3. **No Statistical Rigor**: Most leaderboards publish raw accuracy percentages without **confidence intervals**. A model scoring 86% on 50 questions is statistically indistinguishable from one scoring 82%.
4. **Black-Box Evals**: Teams can't inspect the exact questions a model failed on, making it impossible to audit edge-case failures or prompt sensitivity.

---

## 💡 The Solution: What Orbbit Does

Orbbit gives engineering teams transparent, multi-dimensional evaluation data to make model decisions based on evidence, not vendor marketing.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              ORBBIT ARCHITECTURE                       │
└────────────────────────────────────────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌───────────────────────────────────┐       ┌───────────────────────────────────┐
│         FRONTEND LAYER            │       │         DATA LAYER                │
│  • Next.js 16 (App Router)        │       │  • Supabase (PostgreSQL 15)       │
│  • React 19.2 (Server Components) │       │  • Row Level Security (RLS)       │
│  • Dynamic Value Score Sliders    │       │  • Relational Schema (7 tables)   │
│  • Recharts Radar & Bar Views     │       │  • Session Cookie Auth            │
└─────────────────┬─────────────────┘       └─────────────────▲─────────────────┘
                  │                                           │
                  ▼                                           │
┌───────────────────────────────────┐                         │
│     LIVE EVALUATION ENGINE        │                         │
│  • Universal OpenRouter Gateway   │─────────────────────────┘
│  • Streaming SSE Telemetry        │
│  • Modular Scorers (Exact/Math/k) │
│  • Wilson 95% Confidence Bounds   │
└───────────────────────────────────┘
```

---

## 🎯 Key Features

### 1. Dynamic Leaderboard & The Value Score™
Instead of static rankings, Orbbit introduces the **Value Score**: a composite metric balancing Quality, Cost, and Latency with user-tunable weights:

$$\text{Value Score} = \left( w_q \times \frac{\text{Accuracy}}{\text{Max Acc}} + w_c \times \left(1 - \frac{\text{Cost}}{\text{Max Cost}}\right) + w_s \times \left(1 - \frac{\text{Latency}}{\text{Max Latency}}\right) \right) \times 100$$

* **Interactive Sliders**: Adjust weights in real time (e.g., 70% Quality / 20% Cost / 10% Speed). The leaderboard instantly re-ranks on the client without database round-trips.
* **Presets**: Quick-select profiles (*"Quality First"*, *"Balanced"*, *"Budget & Speed"*), or save custom team presets.
* **CSV Export**: Export full ranked datasets with statistical margins.

### 2. Live Evaluation Runner with Streaming Telemetry
* Run live tests against any model on OpenRouter with zero setup.
* **Real-Time Terminal**: Streams live per-prompt results with latency, token usage, TTFT, and verification status.
* **Supported Standard Suites**: MMLU, GSM8K, ARC-Challenge, HumanEval, TruthfulQA, GPQA, and more.

### 3. "Bring Your Own Benchmark" (Custom CSV/JSON Ingestion)
* Upload proprietary test datasets (`prompt, expected_answer`).
* Test commercial or open-weight models against your company's actual prompts, edge cases, and schemas.

### 4. Statistical Rigor (Wilson 95% Confidence Intervals)
Every score is rendered with its mathematical Wilson Score Interval:

$$w = \frac{\hat{p} + \frac{z^2}{2n} \pm z\sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}$$

Eliminates misleading claims from small evaluation sample sizes.

### 5. Prompt-Level Traceability
Click into any evaluation run to drill into the exact inputs and outputs:
* Full user prompt.
* Model raw response.
* Expected ground truth.
* Scorer reasoning and execution time in milliseconds.

### 6. Side-by-Side Model Comparison
* Pick any two models (e.g., GPT-4o vs Claude 3.5 Sonnet) for direct head-to-head comparison.
* Multidimensional **Recharts Radar Chart** comparing domains (Math, Code, Reasoning).
* Export Executive Decision Memo with monthly cost projections.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router), React 19.2, TypeScript |
| **Styling** | Tailwind CSS v4, shadcn/ui, Lucide Icons |
| **Visualizations** | Recharts (Radar, Bar, Percentile Distributions) |
| **Database & Auth** | Supabase (PostgreSQL with RLS), Cookie-based auth via `proxy.ts` |
| **AI Integration** | OpenRouter REST Client with telemetry and rate-limit backoff |
| **Testing** | Node.js native test runner via `tsx` |

---

## 🚀 Quickstart & Local Setup

### Prerequisites
* Node.js 20.9+
* pnpm 9+
* Supabase project (or local Supabase instance)
* OpenRouter API key

### 1. Clone & Install
```bash
git clone https://github.com/your-username/orbbit.git
cd orbbit
pnpm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter
OPENROUTER_API_KEY=your-openrouter-key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Seed Database
Initialize the schema and seed 177+ models, 18 benchmarks, spaces, and pre-computed evaluation runs:
```bash
pnpm db:seed:all
```

### 4. Run Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### 5. Run Tests
```bash
pnpm test
```

---

## 📂 Project Structure

```
orbbit/
├── src/
│   ├── app/                    # Next.js 16 App Router
│   │   ├── (dashboard)/        # Protected workspace routes
│   │   │   ├── models/         # Model catalog & details
│   │   │   ├── compare/        # Side-by-side comparison & radar
│   │   │   ├── leaderboard/    # Dynamic leaderboard with Value Score
│   │   │   ├── evaluate/       # Live evaluation runner & telemetry
│   │   │   ├── spaces/         # Domain-curated benchmark spaces
│   │   │   └── evaluations/    # Prompt-level drilldowns
│   │   ├── api/                # API routes (evaluations, benchmarks, sync, auth)
│   │   └── proxy.ts            # Auth & guest demo route guard
│   ├── components/
│   │   ├── charts/             # Recharts visualizations
│   │   ├── evaluations/        # Custom benchmark & executive report modals
│   │   ├── layout/             # Shell, sidebar, topbar
│   │   └── ui/                 # shadcn/ui primitives
│   ├── lib/
│   │   ├── eval/               # Runner, statistics (Wilson CI), scorers
│   │   ├── openrouter/         # OpenRouter API client & sync
│   │   └── supabase/           # Client, server, and route handlers
│   └── types/                  # Database & application types
├── supabase/
│   ├── migrations/             # SQL DDL migrations with RLS policies
│   └── seed-*.ts               # Data seeding scripts
└── tests/                      # Automated unit tests for scorers & stats
```

---

## 📜 License

This project is open-source under the [MIT License](LICENSE).
