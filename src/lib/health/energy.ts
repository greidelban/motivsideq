import { type ActivityLevel, type Profile, effectiveGoal, profileAge, profileAgeGroup } from "@/lib/profile/profile";

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
/** Mai suggerire meno di così (né sotto il basale). */
const KCAL_FLOOR = 1200;

export type DailyTargets = {
  /** null = mancano dati, oppure sotto i 18 anni (nessun obiettivo calorico). */
  kcal: number | null;
  protein: number | null;
  /** Cosa manca per calcolare le kcal, se mancano dati. */
  missing: ("sex" | "birth" | "height" | "weight" | "activity")[];
  minor: boolean;
};

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
  if (missing.length > 0 || minor) return { kcal: null, protein, missing, minor };

  const bmr = bmrMifflin({ sex: profile.sex!, kg: weightKg!, cm: profile.heightCm!, age: age! });
  const tdee = bmr * ACTIVITY_FACTORS[profile.activityLevel!];
  const kcal = Math.max(tdee + GOAL_DELTA[goal], bmr, KCAL_FLOOR);
  return { kcal: Math.round(kcal / 10) * 10, protein, missing, minor };
}
