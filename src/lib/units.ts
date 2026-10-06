// Si salva sempre in sistema metrico; le altre unità esistono solo
// nell'interfaccia (come nel database: weight_kg, height_cm).

export const WEIGHT_UNITS = ["kg", "lb"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

const KG_PER_LB = 0.45359237;

/** Da unità dell'utente a kg (arrotondato a 0,1 kg, la precisione salvata). */
export function toKg(value: number, unit: WeightUnit): number {
  const kg = unit === "lb" ? value * KG_PER_LB : value;
  return Math.round(kg * 10) / 10;
}

/** Da kg all'unità dell'utente, con un decimale. */
export function fromKg(kg: number, unit: WeightUnit): number {
  const value = unit === "lb" ? kg / KG_PER_LB : kg;
  return Math.round(value * 10) / 10;
}

export const HEIGHT_UNITS = ["cm", "ft"] as const;
export type HeightUnit = (typeof HEIGHT_UNITS)[number];

const CM_PER_INCH = 2.54;

/** Da piedi e pollici a cm (arrotondato a 0,1 cm, la precisione salvata). */
export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * CM_PER_INCH * 10) / 10;
}

/** Da cm a piedi e pollici interi (5 ft 10 in), come si dice l'altezza in quei paesi. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const total = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(total / 12), inches: total % 12 };
}
