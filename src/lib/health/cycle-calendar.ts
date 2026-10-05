import { addDays, daysBetween } from "@/lib/dates";
import { type CycleStatus, type DayLog, type Period, effectiveEnd, upcomingStarts } from "./cycle";

// Calendario del ciclo (logica pura): cosa mostrare in ogni giorno.
// Le previsioni valgono solo da oggi in avanti; il passato mostra solo ciò che
// è stato registrato. La finestra fertile si mostra per il ciclo in corso e per
// quelli previsti (anche lei è una stima: mai un contraccettivo).

export type DayMark = {
  /** Mestruazione registrata, oppure prevista (da oggi in poi). */
  period: "logged" | "predicted" | null;
  fertile: boolean;
  ovulation: boolean;
  /** Ci sono flusso o sintomi registrati. */
  hasLog: boolean;
};

const EMPTY: DayMark = { period: null, fertile: false, ovulation: false, hasLog: false };

/** Cicli previsti dopo quello in corso, per riempire qualche mese di calendario. */
const PREDICTED_CYCLES = 6;
const LUTEAL_DAYS = 14;

export function cycleCalendar(
  periods: readonly Period[],
  logs: readonly DayLog[],
  status: CycleStatus | null,
  today: string,
): Map<string, DayMark> {
  const marks = new Map<string, DayMark>();
  const mark = (day: string, patch: Partial<DayMark>) => marks.set(day, { ...(marks.get(day) ?? EMPTY), ...patch });

  const periodLength = status?.stats.periodLength ?? 5;
  for (const p of periods) {
    const end = effectiveEnd(p, periodLength, today);
    for (let d = p.start; d <= end; d = addDays(d, 1)) mark(d, { period: "logged" });
  }
  for (const log of logs) if (log.flow !== undefined || log.symptoms.length > 0) mark(log.day, { hasLog: true });

  if (!status) return marks;
  const { cycleLength } = status.stats;
  const predict = (from: string, to: string) => {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (d >= today && marks.get(d)?.period !== "logged") mark(d, { period: "predicted" });
    }
  };
  const fertile = (ovulation: string) => {
    for (let d = addDays(ovulation, -5); d <= addDays(ovulation, 1); d = addDays(d, 1)) mark(d, { fertile: true });
    mark(ovulation, { ovulation: true });
  };

  // Mestruazione in corso non ancora finita: i giorni stimati che mancano.
  if (status.currentStart <= today) predict(addDays(today, 1), status.periodEnd);
  if (status.phase !== "late") fertile(status.ovulation);

  for (const start of upcomingStarts(status, PREDICTED_CYCLES)) {
    predict(start, addDays(start, periodLength - 1));
    fertile(addDays(start, cycleLength - LUTEAL_DAYS));
  }
  return marks;
}

/**
 * Griglia di un mese: settimane da 7 giorni (null = casella vuota prima del 1°).
 * `weekStart`: 1 = lunedì … 7 = domenica (come Intl.Locale.weekInfo.firstDay).
 */
export function monthGrid(year: number, month: number, weekStart: number): (string | null)[] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const weekday = new Date(year, month - 1, 1).getDay() || 7; // 1 = lunedì … 7 = domenica
  const blanks = (weekday - weekStart + 7) % 7;
  const days = daysBetween(first, month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`);
  const cells: (string | null)[] = Array.from({ length: blanks }, () => null);
  for (let i = 0; i < days; i++) cells.push(addDays(first, i));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
