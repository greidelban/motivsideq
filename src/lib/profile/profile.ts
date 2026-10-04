import * as z from "zod/mini";
import { type AgeGroup, MIN_AGE, ageFromBirth, ageGroup } from "@/lib/age";
import { WEIGHT_UNITS } from "@/lib/units";

// Dati del profilo usati da Allenamento e Alimentazione (e dal Ciclo per l'età).
// Stessi vincoli della tabella public.profiles: quando arriverà Supabase si copiano così.

export const SEXES = ["female", "male"] as const;
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const GOALS = ["lose", "maintain", "gain"] as const;
export type Goal = (typeof GOALS)[number];

export const HEIGHT_RANGE = { min: 100, max: 250 } as const;
export const WEIGHT_RANGE = { min: 25, max: 400 } as const;

/** Nome mostrato nel saluto di Oggi: lo vede solo l'utente. */
export const NAME_MAX = 16;

export const profileSchema = z.object({
  displayName: z.optional(z.string().check(z.trim(), z.minLength(1), z.maxLength(NAME_MAX))),
  sex: z.optional(z.enum(SEXES)),
  heightCm: z.optional(z.number().check(z.gte(HEIGHT_RANGE.min), z.lte(HEIGHT_RANGE.max))),
  birthYear: z.optional(z.int().check(z.gte(1900), z.lte(2100))),
  birthMonth: z.optional(z.int().check(z.gte(1), z.lte(12))),
  activityLevel: z.optional(z.enum(ACTIVITY_LEVELS)),
  goal: z.optional(z.enum(GOALS)),
  /** Solo per l'interfaccia: il peso si salva sempre in kg. */
  weightUnit: z.optional(z.enum(WEIGHT_UNITS)),
});
export type Profile = z.infer<typeof profileSchema>;

export const bodyWeightSchema = z.object({
  /** Giorno locale AAAA-MM-GG. */
  day: z.string().check(z.maxLength(10)),
  kg: z.number().check(z.gte(WEIGHT_RANGE.min), z.lte(WEIGHT_RANGE.max)),
});
export type BodyWeight = z.infer<typeof bodyWeightSchema>;

/** Età in anni, o null se manca la data di nascita. */
export function profileAge(profile: Profile, today: Date = new Date()): number | null {
  if (profile.birthYear === undefined || profile.birthMonth === undefined) return null;
  return ageFromBirth(profile.birthYear, profile.birthMonth, today);
}

/** Fascia d'età, o null se manca la data di nascita. */
export function profileAgeGroup(profile: Profile, today: Date = new Date()): AgeGroup | null {
  const age = profileAge(profile, today);
  return age === null ? null : ageGroup(age);
}

/** Vero se la data di nascita è accettabile (almeno 14 anni e non nel futuro). */
export function isBirthAllowed(year: number, month: number, today: Date = new Date()): boolean {
  if (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1)) return false;
  return ageFromBirth(year, month, today) >= MIN_AGE;
}

/** Sotto i 18 anni l'obiettivo "dimagrire" non è ammesso: si torna a "mantenere". */
export function effectiveGoal(profile: Profile, today: Date = new Date()): Goal {
  const goal = profile.goal ?? "maintain";
  return goal === "lose" && profileAgeGroup(profile, today) !== "adult" ? "maintain" : goal;
}

/** Peso più recente (per data), o null. */
export function latestWeight(weights: readonly BodyWeight[]): BodyWeight | null {
  let latest: BodyWeight | null = null;
  for (const w of weights) if (!latest || w.day >= latest.day) latest = w;
  return latest;
}

/** Un solo peso per giorno: quello nuovo sostituisce quello dello stesso giorno. */
export function upsertWeight(weights: readonly BodyWeight[], entry: BodyWeight): BodyWeight[] {
  return [...weights.filter((w) => w.day !== entry.day), entry].sort((a, b) => a.day.localeCompare(b.day));
}

/** Pulisce il nome scritto: spazi in più tolti, al massimo NAME_MAX caratteri. Vuoto = nessun nome. */
export function cleanName(text: string): string | undefined {
  // Stessa misura di zod (unità UTF-16), senza spezzare un'emoji a metà.
  let name = "";
  for (const char of text.trim().replace(/\s+/g, " ")) {
    if (name.length + char.length > NAME_MAX) break;
    name += char;
  }
  return name.trim() || undefined;
}
