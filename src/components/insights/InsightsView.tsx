"use client";

import Link from "next/link";
import { useState } from "react";
import { Segmented } from "@/components/brain/Segmented";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { formatNumber, formatPercent, interpolate } from "@/i18n/format";
import { brainResults } from "@/lib/brain/store";
import { localDateKey } from "@/lib/dates";
import { canUseCycle } from "@/lib/health/cycle-access";
import { cycleConsent, cyclePeriods, workouts } from "@/lib/health/store";
import { type Pair, computeInsights, hasAnyInsight } from "@/lib/insights/insights";
import { checkIns, journalPages } from "@/lib/journal/store";
import { profile } from "@/lib/profile/store";
import { useLocalData } from "@/lib/storage/db";

// Andamento: collegamenti tra i dati, calcolati qui (lib/insights). Ogni
// confronto è una coppia di numeri affiancati, non un grafico: due medie si
// leggono meglio così, anche sul telefono più piccolo.

const PERIODS = [30, 90] as const;
type PeriodDays = (typeof PERIODS)[number];

export function InsightsView() {
  const ready = useLocalData();
  if (!ready) return <div className="min-h-96" />;
  return <Insights />;
}

function Insights() {
  const { locale, dict } = useI18n();
  const t = dict.insights;
  const [days, setDays] = useState<PeriodDays>(30);
  const cycleOn = canUseCycle(profile.use(), cycleConsent.use()) === "ok";
  const periods = cyclePeriods.use();
  const insights = computeInsights({
    checkIns: checkIns.use(),
    workouts: workouts.use(),
    brainResults: brainResults.use(),
    periods: cycleOn ? periods : null,
    pages: journalPages.use(),
    today: localDateKey(),
    days,
  });
  const n = (v: number) => formatNumber(locale, v);
  const weekdayName = (wd: number) => new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(2024, 0, 7 + wd)); // 7/1/2024 = domenica

  return (
    <div className="space-y-3">
      <Panel>
        <p className="text-subhead text-ink-2">{t.intro}</p>
        <div className="mt-4">
          <Segmented
            label={t.period}
            value={days}
            onChange={setDays}
            options={PERIODS.map((d) => ({ value: d, label: t.periods[`d${d}`] }))}
          />
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-3 text-headline font-semibold">{t.summary.title}</h2>
        <div className="grid grid-cols-2 gap-2 text-center">
          {(
            [
              [t.summary.checkIns, insights.summary.checkIns],
              [t.summary.pages, insights.summary.pages],
              [t.summary.workouts, insights.summary.workouts],
              [t.summary.wakeUps, insights.summary.wakeUps],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="card px-2 py-3">
              <p className="num text-title2 font-semibold">{n(value)}</p>
              <p className="text-caption text-muted">{label}</p>
            </div>
          ))}
        </div>
      </Panel>

      {!hasAnyInsight(insights) ? (
        <Panel>
          <p className="text-subhead text-ink-2">{t.empty}</p>
          <Link href="/journal" className="btn btn-primary mt-4 w-full">
            {dict.journal.todayCard.open}
          </Link>
        </Panel>
      ) : (
        <>
          <PairInsight texts={t.sleep} mood={insights.sleep.mood} energy={insights.sleep.energy} />
          <PairInsight texts={t.training} mood={insights.training.mood} energy={insights.training.energy} />
          {insights.reaction && (
            <Panel>
              <h2 className="mb-3 text-headline font-semibold">{t.reaction.title}</h2>
              <Tiles
                a={{ label: t.sleep.a, value: interpolate(t.reaction.ms, { n: n(insights.reaction.a) }) }}
                b={{ label: t.sleep.b, value: interpolate(t.reaction.ms, { n: n(insights.reaction.b) }) }}
              />
              <p className="mt-3 text-subhead">
                {insights.reaction.direction === "same"
                  ? t.reaction.same
                  : interpolate(t.reaction[insights.reaction.direction], { n: formatPercent(locale, insights.reaction.change) })}
              </p>
              <p className="mt-1 text-footnote text-muted">{interpolate(t.sample, { a: n(insights.reaction.daysA), b: n(insights.reaction.daysB) })}</p>
            </Panel>
          )}
          {insights.cycle && <PairInsight texts={t.cycle} mood={insights.cycle.mood} energy={insights.cycle.energy} />}
          {insights.bestWeekday && (
            <Panel>
              <h2 className="mb-2 text-headline font-semibold">{t.weekday.title}</h2>
              <p className="text-subhead first-letter:uppercase">
                {interpolate(t.weekday.text, {
                  day: weekdayName(insights.bestWeekday.weekday),
                  n: formatNumber(locale, insights.bestWeekday.mood, 1),
                })}
              </p>
            </Panel>
          )}
          <p className="on-backdrop px-1 text-footnote">{t.note}</p>
        </>
      )}
    </div>
  );
}

type PairTexts = {
  title: string;
  a: string;
  b: string;
  mood: { higher: string; lower: string };
  energy: { higher: string; lower: string };
};

/** Umore ed energia nei due gruppi di giorni: due numeri affiancati e una frase. */
function PairInsight({ texts, mood, energy }: { texts: PairTexts; mood: Pair | null; energy: Pair | null }) {
  const { locale, dict } = useI18n();
  const t = dict.insights;
  if (!mood && !energy) return null;
  const score = (v: number) => interpolate(t.scale, { n: formatNumber(locale, v, 1) });

  return (
    <Panel className="space-y-4">
      <h2 className="text-headline font-semibold">{texts.title}</h2>
      {(
        [
          ["mood", mood],
          ["energy", energy],
        ] as const
      ).map(([metric, pair]) =>
        pair ? (
          <section key={metric} aria-label={t[metric]}>
            <h3 className="label">{t[metric]}</h3>
            <Tiles a={{ label: texts.a, value: score(pair.a) }} b={{ label: texts.b, value: score(pair.b) }} />
            <p className="mt-2 text-subhead">{pair.direction === "same" ? t.same : texts[metric][pair.direction]}</p>
            <p className="mt-0.5 text-footnote text-muted">{interpolate(t.sample, { a: formatNumber(locale, pair.daysA), b: formatNumber(locale, pair.daysB) })}</p>
          </section>
        ) : null,
      )}
    </Panel>
  );
}

function Tiles({ a, b }: { a: { label: string; value: string }; b: { label: string; value: string } }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[a, b].map((tile) => (
        <div key={tile.label} className="card px-3 py-3">
          <p className="num text-title3 font-semibold">{tile.value}</p>
          <p className="mt-0.5 text-caption text-muted">{tile.label}</p>
        </div>
      ))}
    </div>
  );
}
