"use client";

import { useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { formatNumber } from "@/i18n/format";
import { firstDayOfWeek } from "@/i18n/week";
import { type DayMark, monthGrid } from "@/lib/health/cycle-calendar";

// Calendario del mese: mestruazioni registrate (piene), previste (tratteggiate),
// finestra fertile (ciano tenue), ovulazione (ciano), oggi (anello), giorni con
// flusso o sintomi (puntino). Toccando un giorno lo si apre sotto il calendario.

/** Quanti mesi si può andare indietro e avanti rispetto a oggi. */
const MONTHS_BACK = 24;
const MONTHS_AHEAD = 6;

const monthIndex = (y: number, m: number) => y * 12 + (m - 1);
const fromIndex = (i: number) => ({ y: Math.floor(i / 12), m: (i % 12) + 1 });
const parse = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function CycleCalendar({
  marks,
  today,
  selected,
  onSelect,
}: {
  marks: Map<string, DayMark>;
  today: string;
  selected: string;
  onSelect: (day: string) => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.health.cycle.calendar;
  const todayIndex = monthIndex(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
  const [index, setIndex] = useState(todayIndex);
  const { y, m } = fromIndex(index);
  const weekStart = firstDayOfWeek(locale);
  const cells = monthGrid(y, m, weekStart);

  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  const longDate = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  // 1 gennaio 2024 era lunedì: da lì i nomi brevi dei giorni nell'ordine della lingua.
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const weekday = ((weekStart - 1 + i) % 7) + 1;
    return new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2024, 0, weekday));
  });

  function label(day: string, mark: DayMark | undefined): string {
    const states = [
      day === today && t.state.today,
      mark?.period === "logged" && t.state.period,
      mark?.period === "predicted" && t.state.predicted,
      mark?.ovulation && t.state.ovulation,
      mark?.fertile && !mark.ovulation && t.state.fertile,
      mark?.hasLog && t.state.log,
    ].filter(Boolean);
    return [longDate.format(parse(day)), ...states].join(", ");
  }

  return (
    <Panel>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          aria-label={t.prev}
          disabled={index <= todayIndex - MONTHS_BACK}
          onClick={() => setIndex((i) => i - 1)}
          className="grid size-11 place-items-center rounded-full text-ink-2 hover:bg-[var(--control-bg)] disabled:opacity-30"
        >
          <IconChevronLeft width={20} height={20} />
        </button>
        <h2 className="flex-1 text-center text-headline font-semibold first-letter:uppercase" aria-live="polite">
          {title}
        </h2>
        <button
          type="button"
          aria-label={t.next}
          disabled={index >= todayIndex + MONTHS_AHEAD}
          onClick={() => setIndex((i) => i + 1)}
          className="grid size-11 place-items-center rounded-full text-ink-2 hover:bg-[var(--control-bg)] disabled:opacity-30"
        >
          <IconChevronRight width={20} height={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-caption text-muted" aria-hidden="true">
        {weekdays.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <span key={`blank-${i}`} />;
          const mark = marks.get(day);
          const isToday = day === today;
          const isSelected = day === selected;
          const fill =
            mark?.period === "logged"
              ? "bg-primary text-on-primary font-semibold"
              : mark?.period === "predicted"
                ? "border-2 border-dashed border-primary text-ink"
                : mark?.ovulation
                  ? "bg-secondary/45 text-ink font-semibold"
                  : mark?.fertile
                    ? "bg-secondary/15 text-ink"
                    : day > today
                      ? "text-muted"
                      : "text-ink-2";
          return (
            <button
              key={day}
              type="button"
              aria-label={label(day, mark)}
              aria-pressed={isSelected}
              onClick={() => onSelect(day)}
              className={`num relative grid h-11 place-items-center rounded-full text-subhead transition-colors ${fill} ${
                isToday ? "ring-1 ring-[var(--text)]" : ""
              } ${isSelected ? "outline-2 outline-offset-2 outline-secondary" : ""}`}
            >
              {formatNumber(locale, Number(day.slice(8)))}
              {mark?.hasLog && <span className="absolute bottom-1 size-1 rounded-full bg-current" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-footnote text-ink-2" aria-label={t.title}>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-primary" aria-hidden="true" />
          {t.legend.period}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border-2 border-dashed border-primary" aria-hidden="true" />
          {t.legend.predicted}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-secondary/25" aria-hidden="true" />
          {t.legend.fertile}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-secondary/60" aria-hidden="true" />
          {t.legend.ovulation}
        </li>
      </ul>
      <p className="mt-3 text-footnote text-muted">{t.hint}</p>
    </Panel>
  );
}
