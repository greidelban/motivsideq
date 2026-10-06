"use client";

import { type DistanceUnit, type HeightUnit, type WeightUnit, defaultUnits, distanceUnitFor } from "@/lib/units";
import { profile } from "./store";

/** Unità scelte dall'utente, o quelle del suo paese finché non ne sceglie una. */
export function deviceUnits(): { weight: WeightUnit; height: HeightUnit } {
  return defaultUnits(typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]));
}

export function useUnits(): { weight: WeightUnit; height: HeightUnit; distance: DistanceUnit } {
  const p = profile.use();
  const fallback = deviceUnits();
  const weight = p.weightUnit ?? fallback.weight;
  return { weight, height: p.heightUnit ?? fallback.height, distance: distanceUnitFor(weight) };
}
