"use client";

import Link from "next/link";
import { IconChevronRight } from "@/components/icons";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/format";
import { localDateKey } from "@/lib/dates";
import { type Level, setCheckIn } from "@/lib/journal/journal";
import { checkIns } from "@/lib/journal/store";
import { pulseLight } from "@/lib/light/bus";
import { useLocalData } from "@/lib/storage/db";
import { ScaleField } from "./CheckInFields";

// Il check-in in Oggi: l'umore con un tocco, il resto nel Diario.
export function JournalTodayCard() {
  const { dict } = useI18n();
  const t = dict.journal.todayCard;
  const ready = useLocalData();
  const today = localDateKey();
  const mood = checkIns.use().find((c) => c.day === today)?.mood as Level | undefined;

  return (
    <Panel>
      <Link href="/journal" aria-label={t.open} className="-m-2 flex items-center gap-3 rounded-lg p-2">
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1">{dict.journal.title}</p>
          <h2 className="text-headline font-semibold">{t.question}</h2>
          <p className="mt-1 text-subhead text-muted">
            {mood ? `${interpolate(t.moodToday, { mood: dict.journal.checkIn.levels.mood[mood] })} · ${t.more}` : t.more}
          </p>
        </div>
        <IconChevronRight width={20} height={20} className="shrink-0 text-muted" />
      </Link>
      {/* Prima che i dati siano caricati, uno spazio della stessa altezza (niente salti). */}
      <div className="mt-3 min-h-[52px]">
        {ready && (
          <ScaleField
            scale="mood"
            labelHidden
            value={mood}
            onChange={(value) => {
              checkIns.set((prev) => setCheckIn(prev, today, { mood: value }));
              if (value !== undefined) pulseLight(0.2);
            }}
          />
        )}
      </div>
    </Panel>
  );
}
