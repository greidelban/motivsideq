"use client";

import { useEffect, useRef, useState } from "react";
import { SCHULTE_SIZE, generateSchulteGrid, schulteSeconds } from "@/lib/brain/schulte";
import { useI18n } from "@/i18n/client";
import { formatNumber } from "@/i18n/format";
import { msSince, now } from "@/lib/clock";
import { pulseLight } from "@/lib/light/bus";
import { defaultRng } from "@/lib/random";
import { Countdown } from "./Countdown";
import type { GameComponentProps } from "./types";
import { useAlignToPaint } from "./useAlignToPaint";

const TOTAL = SCHULTE_SIZE * SCHULTE_SIZE;

export function SchulteGame({ onFinish }: GameComponentProps) {
  const { locale, dict } = useI18n();
  const t = dict.games.schulte;
  const [grid, setGrid] = useState<number[] | null>(null);
  const [target, setTarget] = useState(1);
  const [errors, setErrors] = useState(0);
  const [miss, setMiss] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  useAlignToPaint(startedAt, grid);

  useEffect(() => {
    if (!grid) return;
    const id = setInterval(() => setElapsed(msSince(startedAt.current)), 100);
    return () => clearInterval(id);
  }, [grid]);

  function tap(n: number) {
    if (n !== target) {
      setErrors((e) => e + 1);
      setMiss(n);
      setTimeout(() => setMiss((m) => (m === n ? null : m)), 250);
      return;
    }
    if (n === TOTAL) {
      onFinish({
        score: schulteSeconds(msSince(startedAt.current)),
        variant: `${SCHULTE_SIZE}x${SCHULTE_SIZE}`,
        metrics: { errors },
      });
      return;
    }
    setTarget(n + 1);
    pulseLight(0.07);
  }

  if (!grid) {
    return (
      <Countdown
        onDone={() => {
          startedAt.current = now();
          setGrid(generateSchulteGrid(defaultRng));
        }}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between text-subhead">
        <span className="text-muted">
          {t.find} <span className="num text-title3 font-semibold text-ink" aria-live="polite">{target}</span>
        </span>
        <span className="num font-semibold">{formatNumber(locale, elapsed / 1000, 1)} s</span>
      </div>
      <div className="grid aspect-square w-full grid-cols-5 gap-2" role="group" aria-label={t.gridLabel}>
        {grid.map((n) => {
          const found = n < target;
          return (
            <button
              key={n}
              type="button"
              disabled={found}
              onPointerDown={(e) => {
                e.preventDefault();
                tap(n);
              }}
              onClick={(e) => {
                if (e.detail === 0) tap(n);
              }}
              className={`num touch-manipulation rounded-lg text-title2 font-semibold transition-colors duration-150 select-none ${
                found ? "text-muted/40 bg-transparent" : miss === n ? "bg-error/25 text-ink" : "card text-ink active:bg-control"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
