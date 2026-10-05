"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { formatDuration, interpolate } from "@/i18n/format";
import {
  type Problem,
  type TimedAnswer,
  type ZetamacDuration,
  type ZetamacLevel,
  generateProblem,
  isCorrectAnswer,
  mathMetrics,
  problemText,
  zetamacRate,
  zetamacVariant,
} from "@/lib/brain/zetamac";
import { msSince, now } from "@/lib/clock";
import { pulseLight } from "@/lib/light/bus";
import { defaultRng } from "@/lib/random";
import { Countdown } from "./Countdown";
import type { GameComponentProps } from "./types";
import { useAlignToPaint } from "./useAlignToPaint";

const MAX_DIGITS = 6;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"] as const;

export function ZetamacGame({
  level,
  duration,
  onFinish,
}: GameComponentProps & { level: ZetamacLevel; duration: ZetamacDuration }) {
  const { locale, dict } = useI18n();
  const t = dict.games.math;
  const [started, setStarted] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [input, setInput] = useState("");
  const [answers, setAnswers] = useState<TimedAnswer[]>([]);
  const [remaining, setRemaining] = useState<number>(duration);
  const endsAt = useRef(0);
  // Quando è comparso il problema attuale: da qui si misura il tempo di risposta.
  const shownAt = useRef<number | null>(null);
  useAlignToPaint(shownAt, problem);

  const lastMs = answers.at(-1)?.ms;

  const finish = useEffectEvent(() =>
    onFinish({
      score: zetamacRate(answers.length, duration),
      variant: zetamacVariant(level, duration),
      metrics: mathMetrics(answers.length, duration, answers),
    }),
  );

  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt.current - now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        clearInterval(id);
        finish();
      }
    }, 100);
    return () => clearInterval(id);
  }, [started]);

  function showProblem(next: Problem) {
    shownAt.current = now();
    setProblem(next);
  }

  function press(key: string) {
    if (!problem || remaining === 0) return;
    let next = input;
    if (key === "C") next = "";
    else if (key === "⌫") next = input.slice(0, -1);
    else if (input.length < MAX_DIGITS) next = input + key;

    if (isCorrectAnswer(next, problem)) {
      const ms = shownAt.current === null ? 0 : msSince(shownAt.current);
      setAnswers((a) => [...a, { op: problem.op, ms }]);
      pulseLight(0.18);
      setInput("");
      showProblem(generateProblem(defaultRng, level, problem));
    } else {
      setInput(next);
    }
  }

  const pressFromKeyboard = useEffectEvent((e: KeyboardEvent) => {
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === "Backspace") press("⌫");
    else if (e.key === "Escape") press("C");
    else return;
    e.preventDefault();
  });

  useEffect(() => {
    if (!started) return;
    const onKey = (e: KeyboardEvent) => pressFromKeyboard(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started]);

  if (!started) {
    return (
      <Countdown
        onDone={() => {
          endsAt.current = now() + duration * 1000;
          showProblem(generateProblem(defaultRng, level));
          setStarted(true);
        }}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between text-subhead">
        <span className="text-muted">
          {t.correct} <span className="num font-semibold text-ink">{answers.length}</span>
        </span>
        <span
          className={`num font-semibold ${remaining <= 10 ? "text-warning" : "text-ink"}`}
          aria-label={interpolate(t.secondsLeft, { n: remaining })}
        >
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </span>
      </div>

      <div className="card flex min-h-[26dvh] flex-1 flex-col items-center justify-center gap-3 rounded-xl">
        <p className="num text-[44px] leading-none font-semibold" dir="ltr" aria-live="polite">
          {problem && problemText(problem)}
        </p>
        <p className="num min-h-[48px] text-[40px] leading-none font-semibold text-secondary" dir="ltr" aria-label={t.yourAnswer}>
          {input || <span className="text-muted">?</span>}
        </p>
        {/* Tempo dell'ultima risposta giusta: feedback immediato senza distrarre. */}
        <p className="min-h-5 text-footnote text-muted">
          {lastMs !== undefined && (
            <span key={answers.length} className="materialize inline-block">
              {interpolate(t.lastAnswer, { time: formatDuration(locale, lastMs) })}
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2.5" dir="ltr" role="group" aria-label={t.keypad}>
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              press(k);
            }}
            onClick={(e) => {
              // Attivazione da tastiera (Invio/Spazio sul pulsante): il puntatore usa pointerdown.
              if (e.detail === 0) press(k);
            }}
            aria-label={k === "⌫" ? t.deleteDigit : k === "C" ? t.clearAll : k}
            className={`btn min-h-14 touch-manipulation rounded-lg text-title2 select-none ${k === "C" || k === "⌫" ? "btn-ghost text-muted" : "btn-ghost num"}`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
