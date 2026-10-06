import { addDays } from "@/lib/dates";
import { type Profile, profileAgeGroup } from "@/lib/profile/profile";
import { type Workout, hasExercises } from "./workouts";

// Peso rispetto all'altezza (IMC, categorie dell'OMS per gli adulti) con due
// correzioni: chi si allena spesso con i pesi ha più muscolo (l'IMC lo scambia
// per grasso) e il giro vita, se c'è, dice di più. Sotto i 18 anni l'IMC si
// legge con le curve di crescita per età e sesso: l'app non dà un giudizio.
// Logica pura: si prova con Vitest.

export type BmiCategory = "under" | "normal" | "over" | "obese";

/** Allenamenti di forza negli ultimi 28 giorni per considerare "muscoloso" chi li fa (2 a settimana). */
export const STRENGTH_SESSIONS = 8;
const STRENGTH_WINDOW_DAYS = 28;
/** Giro vita oltre la metà dell'altezza: segnale di grasso addominale, anche con un IMC normale. */
const WAIST_RATIO_LIMIT = 0.5;

export function bmi(kg: number, cm: number): number {
  const m = cm / 100;
  return Math.round((kg / (m * m)) * 10) / 10;
}

export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return "under";
  if (value < 25) return "normal";
  return value < 30 ? "over" : "obese";
}

/** Peso consigliato (IMC 18,5–24,9) per un'altezza, in kg. */
export function healthyRange(cm: number): { min: number; max: number } {
  const m2 = (cm / 100) ** 2;
  return { min: Math.round(18.5 * m2 * 10) / 10, max: Math.round(24.9 * m2 * 10) / 10 };
}

/** Si allena spesso con i pesi (palestra, corpo libero, funzionale) nelle ultime 4 settimane? */
export function liftsOften(workouts: readonly Pick<Workout, "type" | "day">[], today: string): boolean {
  const from = addDays(today, -(STRENGTH_WINDOW_DAYS - 1));
  return workouts.filter((w) => hasExercises(w.type) && w.day >= from && w.day <= today).length >= STRENGTH_SESSIONS;
}

export type BodyAssessment =
  | { kind: "missing" }
  | { kind: "minor" }
  | {
      kind: "adult";
      bmi: number;
      category: BmiCategory;
      range: { min: number; max: number };
      /** Si allena spesso con i pesi: un IMC alto può essere muscolo. */
      muscular: boolean;
      /** Giro vita rispetto all'altezza, se indicato. */
      waist: "ok" | "high" | null;
    };

export function assessBody(
  profile: Profile,
  weightKg: number | null,
  workouts: readonly Pick<Workout, "type" | "day">[],
  today: string,
  now: Date = new Date(),
): BodyAssessment {
  const group = profileAgeGroup(profile, now);
  if (group === "minor") return { kind: "minor" };
  if (weightKg === null || profile.heightCm === undefined || group === null) return { kind: "missing" };
  const value = bmi(weightKg, profile.heightCm);
  const category = bmiCategory(value);
  return {
    kind: "adult",
    bmi: value,
    category,
    range: healthyRange(profile.heightCm),
    muscular: (category === "over" || category === "obese") && liftsOften(workouts, today),
    waist: profile.waistCm === undefined ? null : profile.waistCm / profile.heightCm < WAIST_RATIO_LIMIT ? "ok" : "high",
  };
}
