"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/format";
import { formatScore } from "@/lib/brain/display";
import { GAME_IDS, GAMES } from "@/lib/brain/games";
import { resultsFor } from "@/lib/brain/history";
import { bestOf } from "@/lib/brain/stats";
import { brainResults } from "@/lib/brain/store";
import { Sparkline } from "./Sparkline";

const TREND_POINTS = 12;

export function GameList() {
  const { locale, dict } = useI18n();
  const t = dict.mind.list;
  const results = brainResults.use();

  return (
    <ul className="space-y-3">
      {GAME_IDS.map((id) => {
        const g = dict.games[id];
        const all = resultsFor(results, id);
        const last = all.at(-1);
        // Andamento e record sulle prove con le stesse impostazioni dell'ultima.
        const same = last ? resultsFor(results, id, last.variant) : [];
        const scores = same.map((r) => r.score);
        const best = bestOf(scores, GAMES[id].better);
        const trend = scores.slice(-TREND_POINTS);
        const fmt = (n: number) => formatScore(locale, id, n);

        return (
          <li key={id}>
            <Link href={`/mind/${id}`} className="glass flex items-center gap-4 rounded-xl p-4 transition-transform duration-150 active:scale-[0.99]">
              <div className="min-w-0 flex-1">
                <h3 className="text-headline font-semibold">{g.name}</h3>
                <p className="truncate text-footnote text-muted">{g.tagline}</p>
                {last ? (
                  <p className="mt-1.5 text-footnote text-ink-2">
                    {t.last} <span className="num text-ink">{fmt(last.score)}</span> {g.unit}
                    {best !== null && same.length > 1 && (
                      <span className="whitespace-nowrap">
                        {" · "}
                        {t.best} <span className="num text-ink">{fmt(best)}</span>
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="mt-1.5 text-footnote text-muted">
                    {g.duration} · {t.neverPlayed}
                  </p>
                )}
              </div>
              <Sparkline
                values={trend}
                label={interpolate(t.trend, {
                  name: g.name,
                  n: trend.length,
                  from: fmt(trend[0] ?? 0),
                  to: fmt(trend.at(-1) ?? 0),
                  unit: g.unit,
                })}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
