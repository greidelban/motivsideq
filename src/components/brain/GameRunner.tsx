"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import type { GameId } from "@/lib/brain/games";
import { type BrainResult, type ResultVerdict, judgeResult, resultsFor } from "@/lib/brain/history";
import { ROUTINE_ZETAMAC_DURATION, brainSettings } from "@/lib/brain/settings";
import { brainResults, saveBrainResult } from "@/lib/brain/store";
import { pulseLight, useLightEnergy } from "@/lib/light/bus";
import { ZETAMAC_DURATIONS, ZETAMAC_LEVELS, type ZetamacLevel } from "@/lib/brain/zetamac";
import { GameResult } from "./GameResult";
import { ReactionGame } from "./ReactionGame";
import { SchulteGame } from "./SchulteGame";
import { Segmented } from "./Segmented";
import { StroopGame } from "./StroopGame";
import type { GameOutcome } from "./types";
import { ZetamacGame } from "./ZetamacGame";

type Finished = { outcome: GameOutcome; verdict: ResultVerdict; previousCount: number; result: BrainResult };

/**
 * Un gioco dall'inizio alla fine: istruzioni → partita → risultato (salvato in locale).
 * Nella routine del risveglio `onNext` porta al gioco successivo.
 */
export function GameRunner({
  game,
  routine = false,
  onNext,
  nextLabel,
}: {
  game: GameId;
  routine?: boolean;
  onNext?: (result: BrainResult | null) => void;
  nextLabel?: string;
}) {
  const [phase, setPhase] = useState<"intro" | "play" | "result">("intro");
  const [round, setRound] = useState(0);
  const [finished, setFinished] = useState<Finished | null>(null);
  const settings = brainSettings.use();
  const { dict } = useI18n();
  const g = dict.games[game];
  const t = dict.mind;
  const duration = routine ? ROUTINE_ZETAMAC_DURATION : settings.zetamacDuration;
  // Luce calma mentre si gioca (meno distrazioni), più viva sul risultato.
  // Nella routine l'intensità la decide la routine.
  useLightEnergy(routine ? null : phase === "play" ? 0.3 : phase === "result" ? 0.5 : 0.38);

  function finish(outcome: GameOutcome) {
    const previous = brainResults.get();
    const verdict = judgeResult(previous, { game, ...outcome });
    const previousCount = resultsFor(previous, game, outcome.variant).length;
    const result = saveBrainResult({ game, routine, ...outcome });
    pulseLight(verdict.personalBest ? 1.1 : 0.45);
    setFinished({ outcome, verdict, previousCount, result });
    setPhase("result");
  }

  function replay() {
    setFinished(null);
    setRound((r) => r + 1);
    setPhase("play");
  }

  if (phase === "intro") {
    return (
      <div className="materialize flex flex-1 flex-col gap-4">
        <section className="glass-elevated rounded-xl p-6">
          <p className="eyebrow mb-1">{g.duration}</p>
          <h2 className="text-title2 font-bold">{g.name}</h2>
          <p className="mt-3 text-body text-ink-2">{g.howTo}</p>
        </section>

        {game === "math" && (
          <section className="space-y-4">
            <Segmented<ZetamacLevel>
              label={t.intro.difficulty}
              value={settings.zetamacLevel}
              options={(Object.keys(ZETAMAC_LEVELS) as ZetamacLevel[]).map((value) => ({
                value,
                label: dict.games.math.levels[value],
              }))}
              onChange={(zetamacLevel) => brainSettings.set((s) => ({ ...s, zetamacLevel }))}
            />
            {!routine && (
              <Segmented
                label={t.intro.duration}
                value={settings.zetamacDuration}
                options={ZETAMAC_DURATIONS.map((d) => ({ value: d, label: `${d} s` }))}
                onChange={(zetamacDuration) => brainSettings.set((s) => ({ ...s, zetamacDuration }))}
              />
            )}
            <p className="text-footnote text-muted">{dict.games.math.levelInfo[settings.zetamacLevel]}</p>
          </section>
        )}

        <div className="mt-auto flex gap-3">
          {routine && onNext && (
            <button type="button" className="btn btn-ghost" onClick={() => onNext(null)}>
              {t.intro.skip}
            </button>
          )}
          <button type="button" className="btn btn-primary flex-1" onClick={() => setPhase("play")}>
            {t.intro.start}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "play") {
    // `key` cambia a ogni "Rigioca": il gioco riparte da zero.
    switch (game) {
      case "reaction":
        return <ReactionGame key={round} onFinish={finish} />;
      case "colors":
        return <StroopGame key={round} onFinish={finish} />;
      case "math":
        return <ZetamacGame key={round} onFinish={finish} level={settings.zetamacLevel} duration={duration} />;
      case "schulte":
        return <SchulteGame key={round} onFinish={finish} />;
    }
  }

  if (!finished) return null;

  return (
    <GameResult
      game={game}
      outcome={finished.outcome}
      verdict={finished.verdict}
      previousCount={finished.previousCount}
      actions={
        routine && onNext ? (
          <button type="button" className="btn btn-primary flex-1" onClick={() => onNext(finished.result)}>
            {nextLabel ?? t.result.next}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-ghost flex-1" onClick={replay}>
              {t.result.replay}
            </button>
            <Link href="/mind" className="btn btn-primary flex-1">
              {t.result.done}
            </Link>
          </>
        )
      }
    />
  );
}
