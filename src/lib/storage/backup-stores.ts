"use client";

import type { z } from "zod";
import { brainResultSchema } from "@/lib/brain/history";
import { brainSettings } from "@/lib/brain/settings";
import { brainResults } from "@/lib/brain/store";
import { dayLogSchema, periodSchema } from "@/lib/health/cycle";
import { foodEntrySchema } from "@/lib/health/food";
import { cycleConsent, cycleDayLogs, cyclePeriods, foodEntries, workouts } from "@/lib/health/store";
import { workoutSchema } from "@/lib/health/workouts";
import { appearance } from "@/lib/light/appearance";
import { bodyWeightSchema } from "@/lib/profile/profile";
import { bodyWeights, profile } from "@/lib/profile/store";
import { type BackupEntry, type BackupFile, type ImportPlan, buildBackup, planImport } from "./backup";
import type { LocalStore } from "./local-store";

type Included = { entry: BackupEntry; store: LocalStore<unknown> };

const doc = <T,>(store: LocalStore<T>): Included => ({
  entry: { name: store.key, kind: "doc", schema: store.schema },
  store: store as unknown as LocalStore<unknown>,
});

const list = <T,>(store: LocalStore<T[]>, item: z.ZodType<T>, keyOf: (item: T) => string): Included => ({
  entry: { name: store.key, kind: "list", item, keyOf: keyOf as (item: never) => string },
  store: store as unknown as LocalStore<unknown>,
});

// Tutti gli store che finiscono nel file di export. Un modulo nuovo con dati
// dell'utente va aggiunto qui (un test controlla che la lista sia completa).
const STORES: Included[] = [
  doc(profile),
  list(bodyWeights, bodyWeightSchema, (w) => w.day),
  list(brainResults, brainResultSchema, (r) => r.id),
  list(workouts, workoutSchema, (w) => w.id),
  list(foodEntries, foodEntrySchema, (f) => f.id),
  doc(cycleConsent),
  list(cyclePeriods, periodSchema, (p) => p.id),
  list(cycleDayLogs, dayLogSchema, (l) => l.day),
  doc(appearance),
  doc(brainSettings),
];

export const BACKUP_STORE_NAMES = STORES.map((s) => s.entry.name);

const byName = new Map(STORES.map((s) => [s.entry.name, s.store]));
const entries = STORES.map((s) => s.entry);
const read = (name: string) => byName.get(name)!.get();

export function exportData(): BackupFile {
  return buildBackup(entries, read);
}

export function importData(file: BackupFile): ImportPlan {
  const plan = planImport(entries, file, read);
  for (const { name, value } of plan.writes) byName.get(name)!.set(value);
  return plan;
}
