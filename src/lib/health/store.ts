"use client";

import { z } from "zod";
import { localDateKey } from "@/lib/dates";
import { defineStore } from "@/lib/storage/local-store";
import { type CycleConsent, type DayLog, type Period, consentSchema, dayLogSchema, periodSchema } from "./cycle";
import { type FoodEntry, MAX_STORED_FOOD, foodEntrySchema } from "./food";
import { MAX_STORED_WORKOUTS, type Workout, workoutSchema } from "./workouts";

const NO_WORKOUTS: Workout[] = [];
const NO_FOOD: FoodEntry[] = [];
const NO_PERIODS: Period[] = [];
const NO_LOGS: DayLog[] = [];

export const workouts = defineStore("workouts", z.array(workoutSchema), NO_WORKOUTS);
export const foodEntries = defineStore("food-entries", z.array(foodEntrySchema), NO_FOOD);

// Ciclo: dati sanitari, letti e scritti solo dopo il consenso (e solo da maggiorenni).
export const cycleConsent = defineStore<CycleConsent>("cycle-consent", consentSchema, null);
export const cyclePeriods = defineStore("cycle-periods", z.array(periodSchema).max(1000), NO_PERIODS);
export const cycleDayLogs = defineStore("cycle-day-logs", z.array(dayLogSchema).max(5000), NO_LOGS);

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

/** Revoca il consenso e cancella tutti i dati del ciclo. */
export function deleteCycleData() {
  cyclePeriods.clear();
  cycleDayLogs.clear();
  cycleConsent.clear();
}
