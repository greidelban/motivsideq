import { addDays } from "@/lib/dates";
import { type Period, cycleStats, effectiveEnd } from "@/lib/health/cycle";
import type { CheckIn } from "@/lib/journal/journal";

// Insight: collegamenti tra i dati dell'utente, calcolati solo sul telefono
// (niente server, niente AI). Dicono cosa tende ad andare insieme, non cosa
// causa cosa. Ogni confronto compare solo con abbastanza giorni per lato.
// Cibo e peso restano fuori di proposito (temi delicati, anche per i minorenni).

/** Giorni minimi per lato di un confronto. */
const MIN_DAYS = 3;
/** Ore di sonno da cui una notte conta come "piena". */
const SLEEP_GOOD_HOURS = 7;
/** Differenza (sulla scala 1-5) sotto la quale i due lati sono "più o meno uguali". */
const SAME_LEVEL = 0.3;
/** Differenza relativa dei tempi di reazione sotto la quale non si dice nulla. */
const SAME_REACTION = 0.03;
/** Check-in con l'umore necessari per cercare il giorno migliore della settimana. */
const MIN_FOR_WEEKDAY = 14;

type Direction = "higher" | "lower" | "same";

/** Media di due gruppi di giorni: `a` è il lato "di interesse" (sonno pieno, allenamento, mestruazioni). */
export type Pair = { a: number; b: number; daysA: number; daysB: number; direction: Direction };

type Day = { day: string };
type Workoutish = Day;
type BrainResultish = Day & { game: string; score: number; routine: boolean };

export type InsightInput = {
  checkIns: readonly CheckIn[];
  workouts: readonly Workoutish[];
  brainResults: readonly BrainResultish[];
  /** Solo se il Ciclo è attivo (canUseCycle === "ok"); altrimenti null. */
  periods: readonly Period[] | null;
  pages: readonly Day[];
  today: string;
  days: number;
};

export type Insights = {
  from: string;
  sleep: { mood: Pair | null; energy: Pair | null };
  training: { mood: Pair | null; energy: Pair | null };
  /** Tempi di reazione (ms, mediana dei giorni): dopo notti piene (a) e corte (b). */
  reaction: { a: number; b: number; daysA: number; daysB: number; change: number; direction: Direction } | null;
  cycle: { mood: Pair | null; energy: Pair | null } | null;
  /** 0 = domenica … 6 = sabato (come Date.getDay). */
  bestWeekday: { weekday: number; mood: number } | null;
  summary: { checkIns: number; pages: number; workouts: number; trainingDays: number; wakeUps: number };
};

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

function median(xs: readonly number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Confronto tra due gruppi di valori (null se un lato ha meno di MIN_DAYS giorni). */
export function comparePair(a: readonly number[], b: readonly number[]): Pair | null {
  if (a.length < MIN_DAYS || b.length < MIN_DAYS) return null;
  const ma = mean(a);
  const mb = mean(b);
  const diff = ma - mb;
  return {
    a: Math.round(ma * 10) / 10,
    b: Math.round(mb * 10) / 10,
    daysA: a.length,
    daysB: b.length,
    direction: Math.abs(diff) < SAME_LEVEL ? "same" : diff > 0 ? "higher" : "lower",
  };
}

/** Umore ed energia divisi in due gruppi di giorni secondo `inA`. */
function split(checkIns: readonly CheckIn[], inA: (c: CheckIn) => boolean | null) {
  const out = { moodA: [] as number[], moodB: [] as number[], energyA: [] as number[], energyB: [] as number[] };
  for (const c of checkIns) {
    const side = inA(c);
    if (side === null) continue;
    if (c.mood !== undefined) (side ? out.moodA : out.moodB).push(c.mood);
    if (c.energy !== undefined) (side ? out.energyA : out.energyB).push(c.energy);
  }
  return { mood: comparePair(out.moodA, out.moodB), energy: comparePair(out.energyA, out.energyB) };
}

/** Giorni di mestruazione registrati (con la durata stimata per quelle ancora aperte). */
function periodDays(periods: readonly Period[], today: string): Set<string> {
  const { periodLength } = cycleStats(periods);
  const days = new Set<string>();
  for (const p of periods) {
    const end = effectiveEnd(p, periodLength, today);
    for (let d = p.start; d <= end; d = addDays(d, 1)) days.add(d);
  }
  return days;
}

export function computeInsights(input: InsightInput): Insights {
  const { today, days } = input;
  const from = addDays(today, -(days - 1));
  const inWindow = (d: Day) => d.day >= from && d.day <= today;
  const checkIns = input.checkIns.filter(inWindow);
  const workouts = input.workouts.filter(inWindow);
  const trainingDays = new Set(workouts.map((w) => w.day));
  const sleepOf = new Map(checkIns.filter((c) => c.sleepHours !== undefined).map((c) => [c.day, c.sleepHours!]));
  const goodNight = (day: string) => {
    const h = sleepOf.get(day);
    return h === undefined ? null : h >= SLEEP_GOOD_HOURS;
  };

  // Tempi di reazione: mediana di ogni giorno, poi confronto tra notti piene e corte.
  const reactionByDay = new Map<string, number[]>();
  for (const r of input.brainResults) {
    if (r.game !== "reaction" || !inWindow(r) || !(r.score > 0)) continue;
    reactionByDay.set(r.day, [...(reactionByDay.get(r.day) ?? []), r.score]);
  }
  const fast: number[] = [];
  const slow: number[] = [];
  for (const [day, scores] of reactionByDay) {
    const good = goodNight(day);
    if (good === null) continue;
    (good ? fast : slow).push(median(scores));
  }
  let reaction: Insights["reaction"] = null;
  if (fast.length >= MIN_DAYS && slow.length >= MIN_DAYS) {
    const a = Math.round(median(fast));
    const b = Math.round(median(slow));
    // Positivo = più rapidi dopo una notte piena.
    const change = (b - a) / b;
    reaction = { a, b, daysA: fast.length, daysB: slow.length, change, direction: Math.abs(change) < SAME_REACTION ? "same" : change > 0 ? "higher" : "lower" };
  }

  let cycle: Insights["cycle"] = null;
  if (input.periods && input.periods.length > 0) {
    const during = periodDays(input.periods, today);
    cycle = split(checkIns, (c) => during.has(c.day));
  }

  // Giorno migliore: media dell'umore per giorno della settimana (almeno 2 giorni ciascuno),
  // solo se si stacca dalla media generale.
  let bestWeekday: Insights["bestWeekday"] = null;
  const moods = checkIns.filter((c) => c.mood !== undefined);
  if (moods.length >= MIN_FOR_WEEKDAY) {
    const byWeekday = new Map<number, number[]>();
    for (const c of moods) {
      const [y, m, d] = c.day.split("-").map(Number);
      const wd = new Date(y, m - 1, d).getDay();
      byWeekday.set(wd, [...(byWeekday.get(wd) ?? []), c.mood!]);
    }
    const overall = mean(moods.map((c) => c.mood!));
    let best: { weekday: number; mood: number } | null = null;
    for (const [weekday, values] of byWeekday) {
      if (values.length < 2) continue;
      const avg = mean(values);
      if (!best || avg > best.mood) best = { weekday, mood: avg };
    }
    if (best && best.mood - overall >= SAME_LEVEL) bestWeekday = { weekday: best.weekday, mood: Math.round(best.mood * 10) / 10 };
  }

  return {
    from,
    sleep: split(checkIns, (c) => goodNight(c.day)),
    training: split(checkIns, (c) => trainingDays.has(c.day)),
    reaction,
    cycle,
    bestWeekday,
    summary: {
      checkIns: checkIns.length,
      pages: input.pages.filter(inWindow).length,
      workouts: workouts.length,
      trainingDays: trainingDays.size,
      wakeUps: new Set(input.brainResults.filter((r) => r.routine && inWindow(r)).map((r) => r.day)).size,
    },
  };
}

/** C'è almeno un collegamento da mostrare? */
export function hasAnyInsight(i: Insights): boolean {
  return Boolean(i.sleep.mood || i.sleep.energy || i.training.mood || i.training.energy || i.reaction || i.cycle?.mood || i.cycle?.energy || i.bestWeekday);
}
