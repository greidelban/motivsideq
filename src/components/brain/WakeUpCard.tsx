"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { interpolate, plural } from "@/i18n/format";
import { routineDoneOn, routineStreak } from "@/lib/brain/history";
import { ROUTINE_STEPS } from "@/lib/brain/routine";
import { brainResults } from "@/lib/brain/store";
import { localDateKey } from "@/lib/dates";
import { useHydrated } from "@/lib/storage/local-store";

// Scheda "Risveglio": usata in Mente e, finché non è fatta, anche in Oggi.
export function WakeUpCard({ hideWhenDone = false }: { hideWhenDone?: boolean }) {
  const { locale, dict } = useI18n();
  const t = dict.mind.wakeUp;
  const results = brainResults.use();
  const hydrated = useHydrated();
  const today = localDateKey();
  const doneToday = hydrated && routineDoneOn(results, today);
  const days = hydrated ? routineStreak(results, today) : 0;

  if (hideWhenDone && doneToday) return null;

  return (
    <section className="glass-elevated rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">{t.eyebrow}</p>
          <h2 className="text-title3 font-bold">{t.title}</h2>
        </div>
        {days > 0 && (
          <p className="card shrink-0 rounded-full px-3 py-1 text-footnote text-ink-2">{plural(locale, days, t.streak)}</p>
        )}
      </div>
      <p className="mt-2 text-subhead text-muted">{interpolate(t.text, { n: ROUTINE_STEPS.length })}</p>
      {doneToday ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-subhead text-ink-2">
            <span className="text-success" aria-hidden="true">✓ </span>
            {t.doneToday}
          </p>
          <Link href="/mind/wake-up" className="btn btn-ghost">
            {t.redo}
          </Link>
        </div>
      ) : (
        <Link href="/mind/wake-up" className="btn btn-primary mt-4 w-full">
          {t.start}
        </Link>
      )}
    </section>
  );
}
