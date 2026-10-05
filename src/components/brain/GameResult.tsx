"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatDuration, formatNumber, formatPercent, interpolate, plural } from "@/i18n/format";
import { formatScore } from "@/lib/brain/display";
import type { GameId } from "@/lib/brain/games";
import type { ResultVerdict } from "@/lib/brain/history";
import { SCHULTE_SIZE } from "@/lib/brain/schulte";
import { MIN_HISTORY_FOR_COMPARISON } from "@/lib/brain/stats";
import { OPERATIONS, OP_METRIC_KEYS } from "@/lib/brain/zetamac";
import type { GameOutcome } from "./types";

// Sotto il 3% la differenza è rumore: "in linea con il solito".
const NOTICEABLE = 0.03;

type Row = [label: string, value: string];

function detailRows(game: GameId, o: GameOutcome, locale: Locale, dict: Dictionary): Row[] {
  const m = o.metrics;
  const r = dict.mind.rows;
  const dur = (ms: number | undefined): string | null => (ms === undefined ? null : formatDuration(locale, ms));
  const rows: [string, string | null][] = [];

  switch (game) {
    case "reaction": {
      const trials = Object.keys(m)
        .filter((k) => /^trial\d+$/.test(k))
        .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
        .map((k) => formatNumber(locale, m[k]));
      rows.push(
        [r.trials, trials.length ? `${trials.join(" · ")} ms` : null],
        [r.fastest, dur(m.best)],
        [r.slowest, dur(m.worst)],
        [r.falseStarts, formatNumber(locale, m.falseStarts ?? 0)],
      );
      break;
    }
    case "colors":
      rows.push(
        [r.accuracy, `${formatNumber(locale, m.accuracy)}%`],
        [r.errors, formatNumber(locale, m.errors)],
        [r.fastestAnswer, dur(m.fastestMs)],
        [r.slowestAnswer, dur(m.slowestMs)],
      );
      break;
    case "math":
      rows.push(
        [r.correct, formatNumber(locale, m.correct)],
        [r.avgAnswer, dur(m.avgMs)],
        [r.fastestAnswer, dur(m.fastestMs)],
        [r.slowestAnswer, dur(m.slowestMs)],
        [r.duration, `${formatNumber(locale, m.durationSec)} s`],
      );
      break;
    case "schulte":
      rows.push(
        [r.perNumber, formatDuration(locale, (o.score * 1000) / (SCHULTE_SIZE * SCHULTE_SIZE))],
        [r.wrongTaps, formatNumber(locale, m.errors)],
      );
      break;
  }
  return rows.filter((row): row is Row => row[1] !== null);
}

/** Tempo medio per tipo di operazione: barre sottili, valore scritto accanto. */
function OperationTimes({ metrics }: { metrics: Record<string, number> }) {
  const { locale, dict } = useI18n();
  const items = OPERATIONS.flatMap((op) => {
    const ms = metrics[OP_METRIC_KEYS[op]];
    return ms === undefined ? [] : [{ op, ms }];
  });
  if (items.length < 2) return null;
  const max = Math.max(...items.map((i) => i.ms));

  return (
    <section className="card rounded-xl px-4 py-3">
      <h3 className="mb-3 text-subhead text-muted">{dict.mind.rows.byOperation}</h3>
      <ul className="space-y-2.5">
        {items.map(({ op, ms }) => (
          <li key={op} className="grid grid-cols-[1.5rem_1fr_4.5rem] items-center gap-3">
            <span className="num text-center text-title3 text-ink-2" aria-hidden="true">
              {op}
            </span>
            <span className="h-2 overflow-hidden rounded-full" aria-hidden="true">
              <span className="block h-full rounded-full bg-secondary" style={{ width: `${(ms / max) * 100}%` }} />
            </span>
            <span className="num text-end text-subhead">
              <span className="sr-only">{op} </span>
              {formatDuration(locale, ms)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ComparisonLine({ verdict, previousCount }: { verdict: ResultVerdict; previousCount: number }) {
  const { locale, dict } = useI18n();
  const t = dict.mind.result;
  const c = verdict.comparison;
  if (!c) {
    const missing = Math.max(1, MIN_HISTORY_FOR_COMPARISON - previousCount);
    return <p className="text-subhead text-muted">{plural(locale, missing, t.needMore)}</p>;
  }
  const pct = formatPercent(locale, c.improvement);
  if (c.improvement >= NOTICEABLE) {
    return (
      <p className="text-subhead text-ink-2">
        <span className="text-success" aria-hidden="true">▲ </span>
        {interpolate(t.better, { pct })}
      </p>
    );
  }
  if (c.improvement <= -NOTICEABLE) {
    return (
      <p className="text-subhead text-ink-2">
        <span className="text-muted" aria-hidden="true">▼ </span>
        {interpolate(t.worse, { pct })}
      </p>
    );
  }
  return <p className="text-subhead text-ink-2">{t.same}</p>;
}

export function GameResult({
  game,
  outcome,
  verdict,
  previousCount,
  actions,
}: {
  game: GameId;
  outcome: GameOutcome;
  verdict: ResultVerdict;
  previousCount: number;
  actions: ReactNode;
}) {
  const { locale, dict } = useI18n();
  const g = dict.games[game];
  return (
    <div className="materialize flex flex-1 flex-col gap-4">
      <section className="glass-elevated rounded-xl p-6 text-center">
        <p className="eyebrow mb-2">{g.name}</p>
        <p className="text-[56px] leading-none font-semibold tracking-tight">{formatScore(locale, game, outcome.score)}</p>
        <p className="mt-1 text-subhead text-muted">{g.unit}</p>
        {verdict.personalBest && (
          <p
            className="mx-auto mt-4 w-fit rounded-full px-3 py-1 text-footnote font-semibold text-ink"
            style={{ background: "var(--glass-lens)", boxShadow: "var(--glass-lens-edge)" }}
          >
            {dict.mind.result.personalBest}
          </p>
        )}
        <div className="mt-4">
          <ComparisonLine verdict={verdict} previousCount={previousCount} />
        </div>
      </section>

      <dl className="card divide-y divide-hairline rounded-xl">
        {detailRows(game, outcome, locale, dict).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-4 py-3 text-subhead">
            <dt className="text-muted">{k}</dt>
            <dd className="num text-end">{v}</dd>
          </div>
        ))}
        {verdict.best !== null && previousCount > 0 && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-subhead">
            <dt className="text-muted">{dict.mind.rows.personalBest}</dt>
            <dd className="num text-end">
              {formatScore(locale, game, verdict.best)} {g.unit}
            </dd>
          </div>
        )}
      </dl>

      {game === "math" && <OperationTimes metrics={outcome.metrics} />}

      <div className="mt-auto flex gap-3">{actions}</div>
    </div>
  );
}
