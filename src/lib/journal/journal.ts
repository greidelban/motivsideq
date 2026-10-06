import * as z from "zod/mini";
import { addDays, daysBetween } from "@/lib/dates";

// Diario: check-in giornaliero (umore, energia, fame, sonno) e una pagina
// scritta per giorno. Il check-in è l'unica fonte di questi valori: lo leggono
// anche il Ciclo e, più avanti, gli insight. Qui c'è solo logica pura.

export const LEVELS = [1, 2, 3, 4, 5] as const;
export type Level = (typeof LEVELS)[number];

export const SCALES = ["mood", "energy", "hunger"] as const;
export type Scale = (typeof SCALES)[number];

export const SLEEP_RANGE = { min: 0, max: 16, step: 0.5, start: 7.5 } as const;

/** Lunghezza massima di una pagina (cifrata entra comodamente nel limite del cloud). */
export const JOURNAL_TEXT_MAX = 20000;

const level = z.optional(z.int().check(z.gte(1), z.lte(5)));

export const checkInSchema = z.object({
  /** Giorno locale AAAA-MM-GG. */
  day: z.string().check(z.maxLength(10)),
  mood: level,
  energy: level,
  hunger: level,
  sleepHours: z.optional(z.number().check(z.gte(0), z.lte(24))),
});
export type CheckIn = z.infer<typeof checkInSchema>;

export const journalPageSchema = z.object({
  day: z.string().check(z.maxLength(10)),
  text: z.string().check(z.maxLength(JOURNAL_TEXT_MAX)),
  // Testo libero e non un elenco chiuso: se uno spunto sparisce, la pagina resta valida.
  promptKey: z.optional(z.string().check(z.maxLength(40))),
});
export type JournalPage = z.infer<typeof journalPageSchema>;

export type CheckInPatch = Partial<Omit<CheckIn, "day">>;

const isEmptyCheckIn = (c: CheckIn) => SCALES.every((s) => c[s] === undefined) && c.sleepHours === undefined;

/** Aggiorna il check-in di un giorno (undefined toglie un valore; un giorno vuoto non si salva). */
export function setCheckIn(list: readonly CheckIn[], day: string, patch: CheckInPatch): CheckIn[] {
  const existing = list.find((c) => c.day === day) ?? { day };
  const next: CheckIn = { ...existing, ...patch };
  for (const key of Object.keys(next) as (keyof CheckIn)[]) if (next[key] === undefined) delete next[key];
  const rest = list.filter((c) => c.day !== day);
  return isEmptyCheckIn(next) ? rest : [...rest, next];
}

/** Sonno con il passo di mezz'ora, dentro i limiti (il primo tocco parte da 7,5 ore). */
export function stepSleep(current: number | undefined, direction: 1 | -1): number {
  if (current === undefined) return SLEEP_RANGE.start;
  const next = Math.round((current + direction * SLEEP_RANGE.step) / SLEEP_RANGE.step) * SLEEP_RANGE.step;
  return Math.min(SLEEP_RANGE.max, Math.max(SLEEP_RANGE.min, next));
}

/** Scrive la pagina di un giorno; una pagina vuota (solo spazi) sparisce. */
export function setPageText(list: readonly JournalPage[], day: string, text: string, promptKey?: string): JournalPage[] {
  const rest = list.filter((p) => p.day !== day);
  if (text.trim() === "") return rest;
  const page: JournalPage = { day, text: text.slice(0, JOURNAL_TEXT_MAX) };
  if (promptKey !== undefined) page.promptKey = promptKey;
  return [...rest, page];
}

// --- Spunti per scrivere -----------------------------------------------------

export const PROMPTS = [
  "wentWell",
  "learned",
  "grateful",
  "satisfied",
  "hard",
  "tomorrow",
  "energy",
  "people",
  "redo",
  "smallWin",
  "onMind",
  "forYou",
] as const;
export type PromptKey = (typeof PROMPTS)[number];

export const isPromptKey = (key: string | undefined): key is PromptKey => PROMPTS.includes(key as PromptKey);

/** Spunto del giorno: cambia ogni giorno, uguale su tutti i dispositivi; `skip` passa ai successivi. */
export function promptFor(day: string, skip = 0): PromptKey {
  const n = daysBetween("2026-01-01", day) + skip;
  return PROMPTS[((n % PROMPTS.length) + PROMPTS.length) % PROMPTS.length];
}

// --- Settimana e riepilogo -----------------------------------------------------

/** I 7 giorni della settimana che contiene `day` (`weekStart`: 1 = lunedì … 7 = domenica). */
export function weekDays(day: string, weekStart: number): string[] {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay() || 7;
  const first = addDays(day, -((weekday - weekStart + 7) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export type Summary = {
  /** Giorni considerati (fino a oggi compreso). */
  days: number;
  /** Giorni con almeno un valore nel check-in. */
  checkIns: number;
  mood: number | null;
  energy: number | null;
  sleepHours: number | null;
};

const average = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** Medie degli ultimi `days` giorni, oggi compreso. */
export function summarize(list: readonly CheckIn[], today: string, days = 7): Summary {
  const from = addDays(today, -(days - 1));
  const recent = list.filter((c) => c.day >= from && c.day <= today);
  const values = (pick: (c: CheckIn) => number | undefined) =>
    recent.map(pick).filter((v): v is number => v !== undefined);
  return {
    days,
    checkIns: recent.length,
    mood: average(values((c) => c.mood)),
    energy: average(values((c) => c.energy)),
    sleepHours: average(values((c) => c.sleepHours)),
  };
}

/** Livello più vicino a una media (per dirla a parole: "Bene"). */
export const nearestLevel = (value: number): Level => Math.min(5, Math.max(1, Math.round(value))) as Level;

// --- Ricerca --------------------------------------------------------------------

// Minuscole e senza accenti: "perche" trova "perché". I testi non latini
// (cinese, arabo, ebraico, russo) si confrontano così come sono.
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

/** Pagine che contengono il testo cercato, dalla più recente. Ricerca vuota = tutte. */
export function searchPages(list: readonly JournalPage[], query: string): JournalPage[] {
  const q = fold(query.trim());
  const sorted = [...list].sort((a, b) => b.day.localeCompare(a.day));
  return q === "" ? sorted : sorted.filter((p) => fold(p.text).includes(q));
}

/**
 * Un pezzo di pagina da mostrare nell'elenco: l'inizio, oppure il punto in cui
 * compare la ricerca. Si lavora sui caratteri interi (emoji comprese).
 */
export function excerpt(text: string, query: string, length = 120): { text: string; before: boolean; after: boolean } {
  const chars = Array.from(text.replace(/\s+/g, " ").trim());
  const q = fold(query.trim());
  let start = 0;
  if (q !== "") {
    // L'indice va cercato carattere per carattere: fold() può cambiare la lunghezza.
    const at = chars.findIndex((_, i) => fold(chars.slice(i, i + q.length + 4).join("")).startsWith(q));
    // Ci si sposta solo se la parola trovata resterebbe fuori dall'inizio.
    if (at + q.length > length) start = Math.max(0, Math.min(at - Math.floor(length / 3), chars.length - length));
  }
  const end = Math.min(chars.length, start + length);
  return { text: chars.slice(start, end).join(""), before: start > 0, after: end < chars.length };
}
