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
