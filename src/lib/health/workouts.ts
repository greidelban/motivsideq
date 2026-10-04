import { z } from "zod";
import { addDays, localDateKey } from "@/lib/dates";

// Tipi di allenamento con i MET (Compendium of Physical Activities, valori
// arrotondati) per intensità leggera / media / intensa.

export const WORKOUT_CATEGORIES = ["strength", "cardio", "mindBody", "sports"] as const;
export type WorkoutCategory = (typeof WORKOUT_CATEGORIES)[number];

export const WORKOUT_TYPES = {
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
export const WORKOUT_TYPE_IDS = Object.keys(WORKOUT_TYPES) as [WorkoutType, ...WorkoutType[]];

export const INTENSITIES = [1, 2, 3] as const;
export type Intensity = (typeof INTENSITIES)[number];

export const MAX_MINUTES = 600;

export const workoutSchema = z.object({
  id: z.string().max(64),
  /** Giorno locale AAAA-MM-GG. */
  day: z.string().max(10),
  at: z.string().max(40),
  type: z.enum(WORKOUT_TYPE_IDS),
  minutes: z.number().int().min(1).max(MAX_MINUTES),
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  note: z.string().max(200).optional(),
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
