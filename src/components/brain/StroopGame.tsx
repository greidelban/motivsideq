"use client";

import { useRef, useState } from "react";
import {
  STROOP_COLORS,
  STROOP_TRIALS,
  type StroopAnswer,
  type StroopColorId,
  type StroopTrial,
  generateStroopTrial,
  stroopColor,
  summarizeStroop,
} from "@/lib/brain/stroop";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/format";
import { msSince, now } from "@/lib/clock";
import { pulseLight } from "@/lib/light/bus";
import { defaultRng } from "@/lib/random";
import { Countdown } from "./Countdown";
import type { GameComponentProps } from "./types";
import { useAlignToPaint } from "./useAlignToPaint";

// Breve pausa vuota tra una parola e l'altra: rende visibile il cambio anche
// quando l'inchiostro resta uguale.
const GAP_MS = 140;

export function StroopGame({ onFinish }: GameComponentProps) {
  const { dict } = useI18n();
  const t = dict.games.colors;
  const [started, setStarted] = useState(false);
  const [trial, setTrial] = useState<StroopTrial | null>(null);
  const [answers, setAnswers] = useState<StroopAnswer[]>([]);
  const [wrong, setWrong] = useState(false);
  const shownAt = useRef(0);

  useAlignToPaint(shownAt, trial);

  function next(prev?: StroopTrial) {
    setTrial(null);
    setTimeout(() => {
      shownAt.current = now();
      setTrial(generateStroopTrial(defaultRng, prev));
    }, GAP_MS);
  }

  function answer(color: StroopColorId) {
    if (!trial) return;
    const a = { correct: color === trial.ink, ms: msSince(shownAt.current) };
    const all = [...answers, a];
    setAnswers(all);
    setWrong(!a.correct);
    if (a.correct) pulseLight(0.14);
    if (all.length >= STROOP_TRIALS) {
      const s = summarizeStroop(all);
      onFinish({
        // Senza risposte giuste non c'è un tempo valido: si registra il massimo del tempo di risposta.
        score: s.avgMs ?? Math.round(Math.max(...all.map((x) => x.ms))),
        variant: String(STROOP_TRIALS),
        metrics: {
          accuracy: s.accuracy,
          errors: s.errors,
          ...(s.fastestMs !== null && s.slowestMs !== null ? { fastestMs: s.fastestMs, slowestMs: s.slowestMs } : {}),
        },
      });
      return;
    }
    next(trial);
  }

  if (!started) {
    return (
      <Countdown
        onDone={() => {
          setStarted(true);
          shownAt.current = now();
          setTrial(generateStroopTrial(defaultRng));
        }}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-center text-footnote text-muted">
        <span className="num">
          {interpolate(t.progress, { i: Math.min(answers.length + 1, STROOP_TRIALS), n: STROOP_TRIALS })}
        </span>
        <span className={`ml-3 ${wrong ? "text-error" : "invisible"}`} aria-live="polite">
          {wrong ? t.wrong : "·"}
        </span>
      </p>
      <div className="card grid min-h-[34dvh] flex-1 place-items-center rounded-xl" aria-live="assertive">
        {trial && (
          <span className="text-[56px] leading-none font-extrabold tracking-tight uppercase" style={{ color: stroopColor(trial.ink).hex }}>
            {t.names[trial.word]}
          </span>
        )}
      </div>
      <p className="text-center text-footnote text-muted">{t.instruction}</p>
      <div className="grid grid-cols-2 gap-3">
        {STROOP_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              answer(c.id);
            }}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                answer(c.id);
              }
            }}
            className="btn btn-ghost min-h-16 touch-manipulation justify-start rounded-lg px-4 text-body select-none"
          >
            <span className="size-6 shrink-0 rounded-full" style={{ background: c.hex }} aria-hidden="true" />
            {t.names[c.id]}
          </button>
        ))}
      </div>
    </div>
  );
}
