"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LightUp } from "@/components/light/LightUp";
import { useI18n } from "@/i18n/client";
import { interpolate, plural } from "@/i18n/format";
import { formatScore } from "@/lib/brain/display";
import { type BrainResult, judgeResult, routineStreak } from "@/lib/brain/history";
import { ROUTINE_STEPS } from "@/lib/brain/routine";
import { brainResults } from "@/lib/brain/store";
import { pulseLight, useLightEnergy } from "@/lib/light/bus";
import { localDateKey } from "@/lib/dates";
import { ComparisonLine } from "./GameResult";
import { GameHeader } from "./GameHeader";
import { GameRunner } from "./GameRunner";

// La routine del mattino: "Accendi" (respiro con la luce), i giochi in fila,
// poi un riepilogo. La luce viva cresce a ogni esercizio, come un'alba.
export function RoutineRunner() {
  const { locale, dict } = useI18n();
  const t = dict.mind.routine;
  const [lightDone, setLightDone] = useState(false);
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<BrainResult[]>([]);
  const all = brainResults.use();
  const done = step >= ROUTINE_STEPS.length;

  // Durante "Accendi" la luce la guida l'esercizio stesso (null = non toccarla).
  useLightEnergy(!lightDone ? null : done ? 0.75 : 0.32 + 0.1 * step);

  // Fine della routine: la luce sboccia.
  useEffect(() => {
    if (done) pulseLight(1.3);
  }, [done]);

  function next(result: BrainResult | null) {
    if (result) setResults((r) => [...r, result]);
    setStep((s) => s + 1);
  }

  const progress = (
    <ol
      className="flex gap-1.5"
      aria-label={interpolate(t.progress, { i: Math.min(step + 1, ROUTINE_STEPS.length), n: ROUTINE_STEPS.length })}
    >
      {ROUTINE_STEPS.map((g, i) => (
        <li key={g} className={`h-1.5 w-6 rounded-full ${i < step ? "bg-secondary" : i === step ? "bg-ink-2" : "bg-control"}`} />
      ))}
    </ol>
  );

  if (!lightDone) {
    return (
      <>
        <GameHeader title={`${t.title} · ${dict.mind.light.title}`}>{progress}</GameHeader>
        <LightUp routine onNext={() => setLightDone(true)} />
      </>
    );
  }

  if (!done) {
    const game = ROUTINE_STEPS[step];
    return (
      <>
        <GameHeader title={`${t.title} · ${dict.games[game].name}`}>{progress}</GameHeader>
        <GameRunner
          key={game}
          game={game}
          routine
          onNext={next}
          nextLabel={step === ROUTINE_STEPS.length - 1 ? dict.mind.result.seeSummary : dict.mind.result.next}
        />
      </>
    );
  }

  const streakDays = routineStreak(all, localDateKey());

  return (
    <>
      <GameHeader title={t.completed}>{progress}</GameHeader>
      <div className="materialize flex flex-1 flex-col gap-4">
        <section className="glass-elevated rounded-xl p-6 text-center">
          <p className="eyebrow mb-2">{t.eyebrow}</p>
          <p className="text-title1 font-bold">
            {results.length === 0 ? t.skipped : streakDays > 1 ? plural(locale, streakDays, t.streak) : t.firstDay}
          </p>
          <p className="mt-2 text-subhead text-muted">{results.length === 0 ? t.noneDone : t.tip}</p>
        </section>

        {results.length > 0 && (
          <ul className="card divide-y divide-hairline rounded-xl">
            {results.map((r) => {
              const g = dict.games[r.game];
              const previous = all.filter((x) => x.id !== r.id && x.at < r.at);
              const verdict = judgeResult(previous, r);
              const previousCount = previous.filter((x) => x.game === r.game && x.variant === r.variant).length;
              return (
                <li key={r.id} className="space-y-1 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-headline font-semibold">{g.name}</span>
                    <span className="num text-headline">
                      {formatScore(locale, r.game, r.score)} <span className="text-footnote text-muted">{g.unit}</span>
                    </span>
                  </div>
                  <ComparisonLine verdict={verdict} previousCount={previousCount} />
                </li>
              );
            })}
          </ul>
        )}

        <Link href="/today" className="btn btn-primary mt-auto w-full">
          {t.startDay}
        </Link>
      </div>
    </>
  );
}
