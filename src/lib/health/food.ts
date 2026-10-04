import { z } from "zod";

// Conta-calorie a inserimento manuale: niente database di alimenti esterni.

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Meal = (typeof MEALS)[number];

export const MAX_KCAL = 5000;
export const MAX_MACRO_G = 500;

export const foodEntrySchema = z.object({
  id: z.string().max(64),
  /** Giorno locale AAAA-MM-GG. */
  day: z.string().max(10),
  at: z.string().max(40),
  meal: z.enum(MEALS),
  name: z.string().trim().min(1).max(80),
  kcal: z.number().min(0).max(MAX_KCAL),
  protein: z.number().min(0).max(MAX_MACRO_G).optional(),
  carbs: z.number().min(0).max(MAX_MACRO_G).optional(),
  fat: z.number().min(0).max(MAX_MACRO_G).optional(),
});
export type FoodEntry = z.infer<typeof foodEntrySchema>;

export const MAX_STORED_FOOD = 10000;

/** kcal dai macronutrienti (4 / 4 / 9 kcal per grammo). */
export function macroKcal(protein = 0, carbs = 0, fat = 0): number {
  return 4 * protein + 4 * carbs + 9 * fat;
}

/**
 * Le kcal sono coerenti con i macro? Tolleranza: il 20% o 10 kcal, la più larga
 * (stessa regola della tabella foods). Senza macro non si può controllare: vero.
 */
export function kcalConsistent(kcal: number, protein?: number, carbs?: number, fat?: number): boolean {
  if (protein === undefined && carbs === undefined && fat === undefined) return true;
  const fromMacros = macroKcal(protein, carbs, fat);
  return Math.abs(kcal - fromMacros) <= Math.max(0.2 * fromMacros, 10);
}

export type Totals = { kcal: number; protein: number; carbs: number; fat: number };

export function totals(entries: readonly FoodEntry[]): Totals {
  return entries.reduce<Totals>(
    (t, e) => ({
      kcal: t.kcal + e.kcal,
      protein: t.protein + (e.protein ?? 0),
      carbs: t.carbs + (e.carbs ?? 0),
      fat: t.fat + (e.fat ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function entriesOn(entries: readonly FoodEntry[], day: string): FoodEntry[] {
  return entries.filter((e) => e.day === day);
}

/** Ultimi alimenti usati (uno per nome, dal più recente) da riaggiungere con un tocco. */
export function recentFoods(entries: readonly FoodEntry[], limit = 8): FoodEntry[] {
  const seen = new Set<string>();
  const out: FoodEntry[] = [];
  for (const e of [...entries].sort((a, b) => b.at.localeCompare(a.at))) {
    const key = e.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length === limit) break;
  }
  return out;
}

/** Pasto suggerito in base all'ora. */
export function mealForHour(hour: number): Meal {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 18 && hour < 23) return "dinner";
  return "snack";
}
