"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/format";
import { REACTION_TRIALS, isAnticipation, randomDelay, summarizeReaction } from "@/lib/brain/reaction";
import { msSince, now } from "@/lib/clock";
import { pulseLight } from "@/lib/light/bus";
import { defaultRng } from "@/lib/random";
import type { GameComponentProps } from "./types";
import { useAlignToPaint } from "./useAlignToPaint";

type Phase = "ready" | "waiting" | "go" | "feedback" | "early";

const FEEDBACK_MS = 900;

export function ReactionGame({ onFinish }: GameComponentProps) {
  const { dict } = useI18n();
  const t = dict.games.reaction;
  const [phase, setPhase] = useState<Phase>("ready");
  const [times, setTimes] = useState<number[]>([]);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const falseStarts = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goAt = useRef<number | null>(null);

  // Il tempo parte quando il verde viene davvero disegnato.
  useAlignToPaint(goAt, phase === "go");

  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  function startWaiting() {
    goAt.current = null;
    setPhase("waiting");
    timer.current = setTimeout(() => {
      // Valore provvisorio; il frame successivo lo allinea al momento in cui il verde appare.
      goAt.current = now();
      setPhase("go");
    }, randomDelay(defaultRng));
  }

  function falseStart() {
    clearTimeout(timer.current ?? undefined);
    falseStarts.current += 1;
    setPhase("early");
  }

  function handlePress() {
    if (phase === "ready" || phase === "early") return startWaiting();
    if (phase === "waiting") return falseStart();
    if (phase !== "go") return;

    const ms = goAt.current === null ? 0 : msSince(goAt.current);
    if (isAnticipation(ms)) return falseStart();

    const next = [...times, ms];
    setTimes(next);
    setLastMs(Math.round(ms));
    pulseLight(0.3);
    setPhase("feedback");
    timer.current = setTimeout(() => {
      if (next.length < REACTION_TRIALS) return startWaiting();
      const s = summarizeReaction(next);
      onFinish({
        score: s.median,
        variant: String(REACTION_TRIALS),
        metrics: {
          best: s.best,
          worst: s.worst,
          mean: s.mean,
          falseStarts: falseStarts.current,
          // Ogni prova, in ordine (trial1 … trial5).
          ...Object.fromEntries(next.map((ms, i) => [`trial${i + 1}`, Math.round(ms)])),
        },
      });
    }, FEEDBACK_MS);
  }

  const styles: Record<Phase, { className: string; title: string; text: string }> = {
    ready: { className: "card", title: t.ready, text: t.tapToStart },
    waiting: { className: "card", title: t.wait, text: t.dontTap },
    go: { className: "bg-success text-on-secondary", title: t.go, text: "" },
    feedback: {
      className: "card",
      title: `${lastMs ?? ""} ms`,
      text: interpolate(t.trial, { i: times.length, n: REACTION_TRIALS }),
    },
    early: { className: "bg-error/15", title: t.early, text: t.tapToRetry },
  };
  const s = styles[phase];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-center text-subhead text-muted" aria-hidden="true">
        {Array.from({ length: REACTION_TRIALS }, (_, i) => (
          <span key={i} className={`mx-1 inline-block size-2 rounded-full ${i < times.length ? "bg-secondary" : "bg-control"}`} />
        ))}
      </p>
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          handlePress();
        }}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            handlePress();
          }
        }}
        className={`flex min-h-[55dvh] flex-1 touch-manipulation flex-col items-center justify-center gap-2 rounded-xl select-none ${s.className}`}
      >
        <span className="text-large font-bold" aria-live="assertive">
          {s.title}
        </span>
        {s.text && <span className={`text-body ${phase === "go" ? "" : "text-muted"}`}>{s.text}</span>}
      </button>
    </div>
  );
}
