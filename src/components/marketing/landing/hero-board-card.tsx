"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { AccuracyWithCI } from "@/components/evaluations/accuracy-with-ci";
import { formatNumber } from "@/lib/format";
import { getVendorColor } from "@/lib/vendor-colors";
import { EASE_OUT_EXPO, evaluationHref } from "./shared";
import type { HeroBoard, ScoreCell } from "./types";

function sampleLabel(rows: ScoreCell[]): string {
  if (rows.length === 0) return "";
  const ns = rows.map((r) => r.n);
  const min = Math.min(...ns);
  const max = Math.max(...ns);
  return min === max
    ? `n = ${formatNumber(min)} questions each`
    : `n = ${formatNumber(min)}–${formatNumber(max)} questions`;
}

interface HeroBoardCardProps {
  boards: HeroBoard[];
  /** Server-rendered empty state (auth-aware link inside). */
  empty: ReactNode;
  /** Server-rendered footer link (auth-aware). */
  footerLink: ReactNode;
}

/** Hero "Top N on <benchmark>" card with the MMLU / HumanEval switcher. */
export function HeroBoardCard({ boards, empty, footerLink }: HeroBoardCardProps) {
  const [heroBoardIndex, setHeroBoardIndex] = useState<number>(0);
  const heroBoard: HeroBoard | undefined = boards[heroBoardIndex] ?? boards[0];

  return (
    <div className="bg-card border border-border rounded-3xl p-5 sm:p-7 shadow-xs">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground">
            {heroBoard ? `Top ${heroBoard.rows.length} on ${heroBoard.benchmark}` : "Benchmark Leaders"}
          </h3>
          <p className="text-[11px] text-muted-foreground">Accuracy ± Wilson 95% CI</p>
        </div>

        {/* Switcher */}
        {boards.length > 1 && (
          <div role="group" aria-label="Benchmark" className="flex shrink-0 items-center p-0.5 bg-muted rounded-lg border border-border text-xs">
            {boards.map((board, idx) => (
              <button
                key={board.benchmark}
                type="button"
                aria-pressed={heroBoard === board}
                onClick={() => setHeroBoardIndex(idx)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  heroBoard === board
                    ? "bg-card text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {board.benchmark}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Models List */}
      {heroBoard ? (
        <ol className="space-y-3.5 pt-5">
          {heroBoard.rows.map((m, i) => (
            <li key={m.evaluationId}>
              <Link
                href={evaluationHref(m.evaluationId)}
                aria-label={`${m.name} on ${heroBoard.benchmark}: open prompt-level results`}
                className="group block space-y-1.5 rounded-md"
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-muted-foreground text-[11px] font-semibold w-3.5 shrink-0">
                      {i + 1}
                    </span>
                    <span className="truncate font-semibold text-foreground group-hover:underline underline-offset-2">{m.name}</span>
                    <span className="hidden sm:inline text-[10px] text-muted-foreground shrink-0">({m.lab})</span>
                  </div>
                  <AccuracyWithCI
                    accuracy={m.accuracy}
                    lower={m.lower}
                    upper={m.upper}
                    size="xs"
                    className="shrink-0"
                    valueClassName="font-bold"
                  />
                </div>

                {/* Animated Bar (remounts per board so it grows again on switch) */}
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    key={`${heroBoard.benchmark}-${m.evaluationId}`}
                    className="h-full rounded-full"
                    style={{
                      width: `${m.accuracy}%`,
                      backgroundColor: getVendorColor(m.vendor),
                      animation: `landing-grow 0.6s ${EASE_OUT_EXPO} ${i * 50}ms both`,
                    }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="pt-5">{empty}</div>
      )}

      {/* Bottom Card Footer */}
      <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          <span className="font-mono tabular-nums">
            {heroBoard ? sampleLabel(heroBoard.rows) : "Recorded runs only"}
          </span>
        </span>
        {footerLink}
      </div>
    </div>
  );
}
