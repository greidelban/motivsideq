"use client";

import { localDateKey } from "@/lib/dates";
import { localDb } from "@/lib/storage/db";
import { DEFS } from "@/lib/storage/definitions";
import { isCloudLinked } from "@/lib/sync/run";
import { type FoodEntry, MAX_STORED_FOOD } from "./food";
import { MAX_STORED_WORKOUTS, type Workout } from "./workouts";

export const workouts = localDb.store(DEFS.workouts);
export const foodEntries = localDb.store(DEFS.foodEntries);

// Ciclo: dati sanitari, letti e scritti solo dopo il consenso (e solo da maggiorenni).
export const cycleConsent = localDb.store(DEFS.cycleConsent);
export const cyclePeriods = localDb.store(DEFS.cyclePeriods);
export const cycleDayLogs = localDb.store(DEFS.cycleDayLogs);

/** Crea id, ora e giorno locale per un nuovo elemento. */
function stamp() {
  const now = new Date();
  return { id: crypto.randomUUID(), at: now.toISOString(), day: localDateKey(now) };
}

export function addWorkout(input: Omit<Workout, "id" | "at">): Workout {
  const { id, at } = stamp();
  const workout: Workout = { ...input, id, at };
  workouts.set((prev) => [...prev, workout].slice(-MAX_STORED_WORKOUTS));
  return workout;
}

export function addFood(input: Omit<FoodEntry, "id" | "at" | "day">, day?: string): FoodEntry {
  const s = stamp();
  const entry: FoodEntry = { ...input, id: s.id, at: s.at, day: day ?? s.day };
  foodEntries.set((prev) => [...prev, entry].slice(-MAX_STORED_FOOD));
  return entry;
}

/**
 * Revoca il consenso e cancella davvero tutti i dati del ciclo.
 * Senza cloud: spariscono subito dal dispositivo, senza lasciare traccia.
 * Con il cloud: diventano segnali di cancellazione vuoti (senza valori), così
 * spariscono anche dal cloud e dagli altri dispositivi; dopo l'invio la
 * sincronizzazione toglie anche i segnali da qui (engine.ts).
 */
export function deleteCycleData() {
  if (isCloudLinked()) {
    cyclePeriods.clear();
    cycleDayLogs.clear();
    cycleConsent.clear();
  } else {
    cyclePeriods.purge();
    cycleDayLogs.purge();
    cycleConsent.purge();
  }
}
