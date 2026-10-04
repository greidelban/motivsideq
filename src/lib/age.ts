export const MIN_AGE = 14;
const ADULT_AGE = 18;

/**
 * Età in anni compiuti da mese (1-12) e anno di nascita.
 * Prudente: nel mese del compleanno lo si considera non ancora passato.
 * Specchio di public.age_from_birth() nel database.
 */
export function ageFromBirth(year: number, month: number, today: Date = new Date()): number {
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  return currentYear - year - (currentMonth <= month ? 1 : 0);
}

export type AgeGroup = "too_young" | "minor" | "adult";

export function ageGroup(age: number): AgeGroup {
  if (age < MIN_AGE) return "too_young";
  if (age < ADULT_AGE) return "minor";
  return "adult";
}
