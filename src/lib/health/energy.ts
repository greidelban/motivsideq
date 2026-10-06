import { type ActivityLevel, type CustomTargets, type Profile, type Sex, MACRO_LIMITS, effectiveGoal, profileAge, profileAgeGroup } from "@/lib/profile/profile";

// Stime generiche del fabbisogno: non sono un piano alimentare (vedi legal.short.food).

/** Metabolismo basale (Mifflin-St Jeor), kcal/giorno. */
export function bmrMifflin({ sex, kg, cm, age }: { sex: "female" | "male"; kg: number; cm: number; age: number }): number {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === "male" ? 5 : -161);
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Variazione rispetto al mantenimento, in kcal/giorno. */
const GOAL_DELTA = { lose: -400, maintain: 0, gain: 300 } as const;
/** Proteine in g per kg di peso. */
const PROTEIN_PER_KG = { lose: 1.6, maintain: 1.2, gain: 1.6 } as const;
/** Mai suggerire (né accettare) meno di così (decisione con l'utente): 1500 uomini, 1200 donne. */
export const KCAL_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };
export const KCAL_MAX = 6000;
/** Quota delle kcal dai grassi nel calcolo automatico; il resto (tolte le proteine) sono carboidrati. */
const FAT_SHARE = 0.3;

/** kcal di un obiettivo in grammi (4 / 4 / 9 kcal per grammo). */
export const targetKcal = (t: CustomTargets) => 4 * t.protein + 4 * t.carbs + 9 * t.fat;

export type DailyTargets = {
  /** null = mancano dati, oppure sotto i 18 anni (nessun obiettivo calorico). */
  kcal: number | null;
  protein: number | null;
  /** Grammi di carboidrati e grassi: solo insieme alle kcal. */
  carbs: number | null;
  fat: number | null;
  /** Obiettivi scelti dall'utente invece che calcolati. */
  custom: boolean;
  /** Cosa manca per calcolare le kcal, se mancano dati. */
  missing: ("sex" | "birth" | "height" | "weight" | "activity")[];
  minor: boolean;
};

/** Obiettivi scelti a mano: validi solo tra la soglia minima (per sesso) e KCAL_MAX. */
export function checkCustomTargets(t: CustomTargets, sex: Sex | undefined): "ok" | "low" | "high" | "invalid" {
  if (!sex) return "invalid";
  const fields = [t.protein, t.carbs, t.fat] as const;
  if (!fields.every((g) => Number.isInteger(g) && g >= 0)) return "invalid";
  if (t.protein > MACRO_LIMITS.protein || t.carbs > MACRO_LIMITS.carbs || t.fat > MACRO_LIMITS.fat) return "invalid";
  const kcal = targetKcal(t);
  if (kcal < KCAL_FLOOR[sex]) return "low";
  return kcal > KCAL_MAX ? "high" : "ok";
}

/** Grassi e carboidrati dalle kcal e dalle proteine (calcolo automatico). */
export function splitMacros(kcal: number, protein: number): { carbs: number; fat: number } {
  const fat = Math.round((kcal * FAT_SHARE) / 9);
  return { fat, carbs: Math.max(0, Math.round((kcal - 4 * protein - 9 * fat) / 4)) };
}

export function dailyTargets(profile: Profile, weightKg: number | null, today: Date = new Date()): DailyTargets {
  const age = profileAge(profile, today);
  const minor = profileAgeGroup(profile, today) === "minor";
  const goal = effectiveGoal(profile, today);
  const missing: DailyTargets["missing"] = [];
  if (!profile.sex) missing.push("sex");
  if (age === null) missing.push("birth");
  if (profile.heightCm === undefined) missing.push("height");
  if (weightKg === null) missing.push("weight");
  if (!profile.activityLevel) missing.push("activity");

  const protein = weightKg === null ? null : Math.round(weightKg * PROTEIN_PER_KG[goal]);
  // Sotto i 18 anni niente obiettivo calorico, nemmeno scelto a mano.
  if (minor) return { kcal: null, protein, carbs: null, fat: null, custom: false, missing, minor };

  const custom = profile.customTargets;
  if (custom && checkCustomTargets(custom, profile.sex) === "ok") {
    return { kcal: Math.round(targetKcal(custom)), ...custom, custom: true, missing, minor };
  }
  if (missing.length > 0) return { kcal: null, protein, carbs: null, fat: null, custom: false, missing, minor };

  const bmr = bmrMifflin({ sex: profile.sex!, kg: weightKg!, cm: profile.heightCm!, age: age! });
  const tdee = bmr * ACTIVITY_FACTORS[profile.activityLevel!];
  const kcal = Math.round(Math.max(tdee + GOAL_DELTA[goal], bmr, KCAL_FLOOR[profile.sex!]) / 10) * 10;
  return { kcal, protein, ...splitMacros(kcal, protein!), custom: false, missing, minor };
}
