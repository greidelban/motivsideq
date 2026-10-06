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

/** Paesi che usano libbre, piedi e miglia nella vita di tutti i giorni. */
const IMPERIAL_REGIONS = new Set(["US", "LR", "MM"]);

/** Le lingue del telefono indicano un paese con libbre e piedi? (es. "en-US"). */
export function prefersImperial(languages: readonly string[]): boolean {
  for (const tag of languages) {
    try {
      const region = new Intl.Locale(tag).maximize().region;
      // Conta la prima lingua con un paese esplicito: "en" da solo non dice nulla.
      if (tag.includes("-") && region) return IMPERIAL_REGIONS.has(region);
    } catch {
      // Etichetta non valida: si passa alla prossima.
    }
  }
  return false;
}

/** Unità di partenza finché l'utente non ne sceglie una (dalle lingue del telefono). */
export function defaultUnits(languages: readonly string[]): { weight: WeightUnit; height: HeightUnit } {
  return prefersImperial(languages) ? { weight: "lb", height: "ft" } : { weight: "kg", height: "cm" };
}

export type DistanceUnit = "km" | "mi";
const KM_PER_MILE = 1.609344;

/** Chi usa le libbre misura le distanze in miglia. */
export const distanceUnitFor = (weight: WeightUnit): DistanceUnit => (weight === "lb" ? "mi" : "km");

/** Da unità dell'utente a km (precisione salvata: 0,01 km). */
export function toKm(value: number, unit: DistanceUnit): number {
  return Math.round((unit === "mi" ? value * KM_PER_MILE : value) * 100) / 100;
}

/** Da km all'unità dell'utente, senza arrotondare (lo fa chi mostra il numero). */
export function fromKm(km: number, unit: DistanceUnit): number {
  return unit === "mi" ? km / KM_PER_MILE : km;
}

/** Da cm a pollici (giro vita), un decimale. */
export const cmToInches = (cm: number) => Math.round((cm / CM_PER_INCH) * 10) / 10;
/** Da pollici a cm, un decimale. */
export const inchesToCm = (inches: number) => Math.round(inches * CM_PER_INCH * 10) / 10;
