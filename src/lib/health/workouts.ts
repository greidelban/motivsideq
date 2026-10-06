import * as z from "zod/mini";
import { addDays, localDateKey } from "@/lib/dates";
import { type DistanceUnit, fromKm } from "@/lib/units";
import { MAX_EXERCISES, exerciseLogSchema } from "./exercises";

// Tipi di allenamento con i MET (Compendium of Physical Activities, valori
// arrotondati) per intensità leggera / media / intensa.

export const WORKOUT_CATEGORIES = ["strength", "cardio", "mindBody", "sports"] as const;
export type WorkoutCategory = (typeof WORKOUT_CATEGORIES)[number];

const WORKOUT_TYPES = {
  gym: { category: "strength", met: [3.5, 5, 6] },
  calisthenics: { category: "strength", met: [3.8, 5, 8] },
  crossfit: { category: "strength", met: [5.5, 7.5, 9.5] },
  running: { category: "cardio", met: [7, 9.8, 11.5] },
  walking: { category: "cardio", met: [3, 3.8, 5] },
  cycling: { category: "cardio", met: [4, 7.5, 10] },
  swimming: { category: "cardio", met: [5.8, 8.3, 10] },
  hiit: { category: "cardio", met: [6, 8, 10] },
  rowing: { category: "cardio", met: [4.8, 7, 8.5] },
  hiking: { category: "cardio", met: [5.3, 6, 7.8] },
  yoga: { category: "mindBody", met: [2.5, 3, 4] },
  pilates: { category: "mindBody", met: [2.8, 3, 3.8] },
  stretching: { category: "mindBody", met: [2.3, 2.5, 3] },
  martialArts: { category: "sports", met: [5.3, 7.8, 10.3] },
  dance: { category: "sports", met: [4.5, 5.5, 7.8] },
  teamSports: { category: "sports", met: [6, 7, 8] },
  racket: { category: "sports", met: [5, 7, 8] },
  climbing: { category: "sports", met: [5.8, 7.5, 8] },
  other: { category: "sports", met: [3.5, 5, 7] },
} as const satisfies Record<string, { category: WorkoutCategory; met: readonly [number, number, number] }>;

export type WorkoutType = keyof typeof WORKOUT_TYPES;
const WORKOUT_TYPE_IDS = Object.keys(WORKOUT_TYPES) as [WorkoutType, ...WorkoutType[]];

export type Intensity = 1 | 2 | 3;

/** Tipi con esercizi, serie e pesi. */
const STRENGTH_TYPES: readonly WorkoutType[] = ["gym", "calisthenics", "crossfit"];
/** Tipi con la distanza: "pace" = minuti al km (corsa, camminata), "speed" = km/h. */
const DISTANCE_TYPES: Partial<Record<WorkoutType, "pace" | "speed">> = {
  running: "pace",
  walking: "pace",
  hiking: "pace",
  cycling: "speed",
  swimming: "pace",
  rowing: "pace",
};
export const MAX_KM = 1000;

export const hasExercises = (type: WorkoutType) => STRENGTH_TYPES.includes(type);
export const distanceMode = (type: WorkoutType) => DISTANCE_TYPES[type] ?? null;

export const MAX_MINUTES = 600;

export const workoutSchema = z.object({
  id: z.string().check(z.maxLength(64)),
  /** Giorno locale AAAA-MM-GG. */
  day: z.string().check(z.maxLength(10)),
  at: z.string().check(z.maxLength(40)),
  type: z.enum(WORKOUT_TYPE_IDS),
  minutes: z.int().check(z.gte(1), z.lte(MAX_MINUTES)),
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  note: z.optional(z.string().check(z.maxLength(200))),
  /** Esercizi con le serie (palestra, corpo libero, funzionale). */
  exercises: z.optional(z.array(exerciseLogSchema).check(z.maxLength(MAX_EXERCISES))),
  /** Distanza in km (corsa, bici, nuoto...). */
  distanceKm: z.optional(z.number().check(z.gt(0), z.lte(MAX_KM))),
});
export type Workout = z.infer<typeof workoutSchema>;

export const MAX_STORED_WORKOUTS = 3000;

export function typesIn(category: WorkoutCategory): WorkoutType[] {
  return WORKOUT_TYPE_IDS.filter((id) => WORKOUT_TYPES[id].category === category);
}

/** kcal stimate: MET × kg × ore. null se manca il peso. */
export function workoutKcal(w: Pick<Workout, "type" | "minutes" | "intensity">, weightKg: number | null): number | null {
  if (weightKg === null) return null;
  const met = WORKOUT_TYPES[w.type].met[w.intensity - 1];
  return Math.round(met * weightKg * (w.minutes / 60));
}

/** Lunedì della settimana del giorno dato (AAAA-MM-GG). */
export function weekStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // 0 = lunedì
  return addDays(day, -weekday);
}

export type WeekSummary = { sessions: number; minutes: number; kcal: number | null; activeDays: number };

/** Totali della settimana in corso (da lunedì a oggi). */
export function weekSummary(workouts: readonly Workout[], weightKg: number | null, today: string = localDateKey()): WeekSummary {
  const from = weekStart(today);
  const week = workouts.filter((w) => w.day >= from && w.day <= today);
  const kcal = weightKg === null ? null : week.reduce((sum, w) => sum + (workoutKcal(w, weightKg) ?? 0), 0);
  return {
    sessions: week.length,
    minutes: week.reduce((sum, w) => sum + w.minutes, 0),
    kcal,
    activeDays: new Set(week.map((w) => w.day)).size,
  };
}

/** Più recenti per primi. */
export function sortRecent<T extends { at: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Passo (secondi al km o al miglio) oppure velocità (km/h o mph), secondo il
 * tipo e l'unità dell'utente. null se mancano i dati.
 */
export function paceOrSpeed(
  type: WorkoutType,
  minutes: number,
  km: number | undefined,
  unit: DistanceUnit = "km",
): { kind: "pace"; seconds: number } | { kind: "speed"; perHour: number } | null {
  const mode = distanceMode(type);
  if (!mode || !km || km <= 0 || minutes <= 0) return null;
  const distance = fromKm(km, unit);
  return mode === "pace" ? { kind: "pace", seconds: Math.round((minutes * 60) / distance) } : { kind: "speed", perHour: Math.round((distance / (minutes / 60)) * 10) / 10 };
}

/** Tipi mostrati in cima a "Registra un allenamento": gli altri dietro un tasto. */
export const MAX_MY_TYPES = 4;

/** Ultima volta (data e ora) di ogni tipo. */
function lastUse(workouts: readonly Pick<Workout, "type" | "at">[]): Map<WorkoutType, string> {
  const last = new Map<WorkoutType, string>();
  for (const w of workouts) if ((last.get(w.type) ?? "") < w.at) last.set(w.type, w.at);
  return last;
}

/** I tipi dell'utente: quelli scelti, oppure (la prima volta) quelli usati di recente. */
export function myTypes(saved: readonly WorkoutType[], workouts: readonly Pick<Workout, "type" | "at">[]): WorkoutType[] {
  if (saved.length > 0) return saved.slice(0, MAX_MY_TYPES);
  return [...lastUse(workouts)]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, MAX_MY_TYPES)
    .map(([type]) => type);
}

/**
 * Aggiunge un tipo a quelli dell'utente. Se sono già quattro, esce quello
 * usato meno di recente (mai usato = il primo a uscire).
 */
export function addMyType(current: readonly WorkoutType[], type: WorkoutType, workouts: readonly Pick<Workout, "type" | "at">[]): WorkoutType[] {
  if (current.includes(type)) return [...current];
  if (current.length < MAX_MY_TYPES) return [...current, type];
  const last = lastUse(workouts);
  const out = current.reduce((oldest, t) => ((last.get(t) ?? "") < (last.get(oldest) ?? "") ? t : oldest));
  return [...current.filter((t) => t !== out), type];
}

/** Tipo valido (dalla bozza, che è testo). */
export const isWorkoutType = (v: string): v is WorkoutType => v in WORKOUT_TYPES;
