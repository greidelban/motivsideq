"use client";

import * as z from "zod/mini";
import { defineStore } from "@/lib/storage/local-store";
import { MAX_MY_TYPES, type WorkoutType, isWorkoutType } from "./workouts";

// Preferenze di Allenamento di questo telefono (come quelle dei giochi):
// i tipi in cima al modulo e l'ultimo recupero scelto. In localStorage, fuori da cloud e backup.

export const REST_RANGE = { min: 15, max: 300, step: 15 } as const;

const schema = z.object({
  types: z.array(z.string().check(z.maxLength(20))).check(z.maxLength(MAX_MY_TYPES)),
  rest: z.int().check(z.gte(REST_RANGE.min), z.lte(REST_RANGE.max)),
});

export const trainingPrefs = defineStore("training-prefs", schema, { types: [], rest: 90 });

/** I tipi salvati che questa versione dell'app conosce. */
export const savedTypes = (types: readonly string[]): WorkoutType[] => types.filter(isWorkoutType);
