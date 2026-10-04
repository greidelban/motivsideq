import { z } from "zod";
import { addDays, daysBetween } from "@/lib/dates";

// Ciclo mestruale: metodo del calendario, tutto calcolato sul dispositivo.
// Le previsioni sono stime (legal.short.cycle): non è un contraccettivo.

export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_LENGTH = 5;
/** Fase luteale media: l'ovulazione cade circa 14 giorni prima del ciclo successivo. */
export const LUTEAL_DAYS = 14;
/** Cicli considerati per le medie (i più recenti). */
const RECENT_CYCLES = 6;
/** Durate fuori da questi limiti sono dimenticanze o errori: non entrano nelle medie. */
const CYCLE_RANGE = { min: 15, max: 90 } as const;
const PERIOD_RANGE = { min: 1, max: 15 } as const;
/** Differenza tra ciclo più corto e più lungo oltre cui si parla di ciclo irregolare. */
const IRREGULAR_SPREAD = 9;

export const periodSchema = z.object({
  id: z.string().max(64),
  /** Primo giorno di mestruazioni, AAAA-MM-GG. */
  start: z.string().max(10),
  /** Ultimo giorno, se registrato. */
  end: z.string().max(10).optional(),
});
export type Period = z.infer<typeof periodSchema>;

export const SYMPTOMS = [
  "cramps",
  "headache",
  "bloating",
  "fatigue",
  "moodSwings",
  "acne",
  "breastTenderness",
  "cravings",
  "backPain",
  "nausea",
] as const;
export type Symptom = (typeof SYMPTOMS)[number];

export const FLOWS = ["spotting", "light", "medium", "heavy"] as const;
export type Flow = (typeof FLOWS)[number];

export const dayLogSchema = z.object({
  day: z.string().max(10),
  flow: z.enum(FLOWS).optional(),
  symptoms: z.array(z.enum(SYMPTOMS)).max(SYMPTOMS.length),
});
export type DayLog = z.infer<typeof dayLogSchema>;

// policyVersion manca nei consensi dati prima della versione dell'informativa:
// valgono come da rinnovare. enabled = false: sezione in pausa (dati conservati).
export const consentSchema = z
  .object({
    acceptedAt: z.string().max(40),
    policyVersion: z.string().max(20).optional(),
    enabled: z.boolean().default(true),
  })
  .nullable();
export type CycleConsent = z.infer<typeof consentSchema>;

export function sortPeriods(periods: readonly Period[]): Period[] {
  return [...periods].sort((a, b) => a.start.localeCompare(b.start));
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Durate dei cicli completi (da un inizio al successivo), dal più vecchio. */
export function cycleLengths(periods: readonly Period[]): number[] {
  const sorted = sortPeriods(periods);
  const out: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const len = daysBetween(sorted[i - 1].start, sorted[i].start);
    if (len >= CYCLE_RANGE.min && len <= CYCLE_RANGE.max) out.push(len);
  }
  return out;
}

export type CycleStats = {
  cycleLength: number;
  periodLength: number;
  /** Cicli completi usati per la media (0 = valori standard). */
  basedOn: number;
  irregular: boolean;
  shortest: number | null;
  longest: number | null;
};

export function cycleStats(periods: readonly Period[]): CycleStats {
  const lengths = cycleLengths(periods).slice(-RECENT_CYCLES);
  const durations = sortPeriods(periods)
    .filter((p) => p.end !== undefined)
    .map((p) => daysBetween(p.start, p.end!) + 1)
    .filter((d) => d >= PERIOD_RANGE.min && d <= PERIOD_RANGE.max)
    .slice(-RECENT_CYCLES);
  const shortest = lengths.length ? Math.min(...lengths) : null;
  const longest = lengths.length ? Math.max(...lengths) : null;
  return {
    cycleLength: lengths.length ? Math.round(mean(lengths)) : DEFAULT_CYCLE_LENGTH,
    periodLength: durations.length ? Math.round(mean(durations)) : DEFAULT_PERIOD_LENGTH,
    basedOn: lengths.length,
    irregular: lengths.length >= 3 && longest! - shortest! > IRREGULAR_SPREAD,
    shortest,
    longest,
  };
}

export type CyclePhase = "menstrual" | "follicular" | "fertile" | "luteal" | "late";

export type CycleStatus = {
  /** Giorno del ciclo, da 1 (primo giorno di mestruazioni). */
  day: number;
  phase: CyclePhase;
  currentStart: string;
  /** Ultimo giorno (registrato o stimato) delle mestruazioni in corso. */
  periodEnd: string;
  /** La mestruazione in corso non ha ancora una fine registrata. */
  periodOpen: boolean;
  nextStart: string;
  /** Giorni al prossimo ciclo (0 = previsto oggi, negativo = in ritardo). */
  daysUntilNext: number;
  ovulation: string;
  fertileStart: string;
  fertileEnd: string;
  stats: CycleStats;
};

export function cycleStatus(periods: readonly Period[], today: string): CycleStatus | null {
  const past = sortPeriods(periods).filter((p) => p.start <= today);
  const current = past.at(-1);
  if (!current) return null;

  const stats = cycleStats(periods);
  const day = daysBetween(current.start, today) + 1;
  const periodEnd = current.end ?? addDays(current.start, stats.periodLength - 1);
  const nextStart = addDays(current.start, stats.cycleLength);
  const ovulation = addDays(nextStart, -LUTEAL_DAYS);
  const fertileStart = addDays(ovulation, -5);
  const fertileEnd = addDays(ovulation, 1);
  const daysUntilNext = daysBetween(today, nextStart);

  let phase: CyclePhase;
  if (today <= periodEnd) phase = "menstrual";
  else if (daysUntilNext < 0) phase = "late";
  else if (today >= fertileStart && today <= fertileEnd) phase = "fertile";
  else if (today < fertileStart) phase = "follicular";
  else phase = "luteal";

  return {
    day,
    phase,
    currentStart: current.start,
    periodEnd,
    periodOpen: current.end === undefined && today <= periodEnd,
    nextStart,
    daysUntilNext,
    ovulation,
    fertileStart,
    fertileEnd,
    stats,
  };
}

/** Prossimi inizi previsti (per il calendario). */
export function upcomingStarts(status: CycleStatus, count: number): string[] {
  const first = status.daysUntilNext < 0 ? addDays(status.nextStart, -status.daysUntilNext) : status.nextStart;
  return Array.from({ length: count }, (_, i) => addDays(first, i * status.stats.cycleLength));
}

export type StartResult = { ok: true; periods: Period[] } | { ok: false; reason: "future" | "duplicate" | "insidePeriod" };

/** Registra l'inizio delle mestruazioni. Chiude quella aperta precedente, se serve. */
export function startPeriod(periods: readonly Period[], day: string, today: string, id: string): StartResult {
  if (day > today) return { ok: false, reason: "future" };
  const sorted = sortPeriods(periods);
  if (sorted.some((p) => p.start === day)) return { ok: false, reason: "duplicate" };
  if (sorted.some((p) => p.end !== undefined && day > p.start && day <= p.end)) return { ok: false, reason: "insidePeriod" };
  const stats = cycleStats(periods);
  const next = sorted.map((p) => {
    // Una mestruazione rimasta "aperta" prima di questa si chiude con la durata media.
    if (p.end !== undefined || p.start > day) return p;
    const end = addDays(p.start, stats.periodLength - 1);
    return { ...p, end: end < day ? end : addDays(day, -1) };
  });
  return { ok: true, periods: sortPeriods([...next, { id, start: day }]) };
}

/** Segna la fine della mestruazione più recente iniziata entro `day`. */
export function endPeriod(periods: readonly Period[], day: string): Period[] | null {
  const sorted = sortPeriods(periods);
  const target = sorted.filter((p) => p.start <= day).at(-1);
  if (!target) return null;
  return sorted.map((p) => (p.id === target.id ? { ...p, end: day } : p));
}

export function toggleSymptom(logs: readonly DayLog[], day: string, symptom: Symptom): DayLog[] {
  const existing = logs.find((l) => l.day === day) ?? { day, symptoms: [] };
  const symptoms = existing.symptoms.includes(symptom)
    ? existing.symptoms.filter((s) => s !== symptom)
    : [...existing.symptoms, symptom];
  return withLog(logs, { ...existing, symptoms });
}

export function setFlow(logs: readonly DayLog[], day: string, flow: Flow | undefined): DayLog[] {
  const existing = logs.find((l) => l.day === day) ?? { day, symptoms: [] };
  return withLog(logs, { ...existing, flow });
}

function withLog(logs: readonly DayLog[], log: DayLog): DayLog[] {
  const rest = logs.filter((l) => l.day !== log.day);
  // Un giorno senza nulla non si salva.
  return log.symptoms.length === 0 && log.flow === undefined ? rest : [...rest, log];
}
