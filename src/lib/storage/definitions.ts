import * as z from "zod/mini";
import { brainResultSchema } from "@/lib/brain/history";
import { consentSchema, dayLogSchema, periodSchema } from "@/lib/health/cycle";
import { foodEntrySchema } from "@/lib/health/food";
import { workoutSchema } from "@/lib/health/workouts";
import { checkInSchema, journalPageSchema } from "@/lib/journal/journal";
import { bodyWeightSchema, profileSchema } from "@/lib/profile/profile";
import type { Def, DocDef, ListDef } from "./records";

// Tutti i dati dell'utente salvati in IndexedDB, in un posto solo: la
// migrazione dal vecchio localStorage deve conoscerli tutti fin dall'avvio.
// Il nome coincide con la vecchia chiave (ritmo:v1:<nome>).
// Le impostazioni del dispositivo (sfondo, animazioni, durata del calcolo)
// restano in localStorage: sono piccole, servono subito e non vanno nel cloud.

const list = <T,>(name: string, item: z.core.$ZodType<T>, keyOf: (item: T) => string, sync = true): ListDef<T> => ({
  kind: "list",
  name,
  item,
  keyOf,
  sync,
});

const doc = <T,>(name: string, schema: z.core.$ZodType<T>, fallback: T, sync = true): DocDef<T> => ({
  kind: "doc",
  name,
  schema,
  fallback,
  sync,
});

export const DEFS = {
  profile: doc("profile", profileSchema, {}),
  bodyWeights: list("body-weights", bodyWeightSchema, (w) => w.day),
  brainResults: list("brain-results", brainResultSchema, (r) => r.id),
  workouts: list("workouts", workoutSchema, (w) => w.id),
  foodEntries: list("food-entries", foodEntrySchema, (f) => f.id),
  cycleConsent: doc("cycle-consent", consentSchema, null),
  cyclePeriods: list("cycle-periods", periodSchema, (p) => p.id),
  cycleDayLogs: list("cycle-day-logs", dayLogSchema, (l) => l.day),
  checkIns: list("check-ins", checkInSchema, (c) => c.day),
  journalPages: list("journal-pages", journalPageSchema, (p) => p.day),
};

export const ALL_DEFS: readonly Def[] = Object.values(DEFS) as Def[];

/** Elenchi che vanno nel cloud cifrato (con l'abbonamento). */
export const SYNCED_COLLECTIONS: readonly string[] = ALL_DEFS.filter((d) => d.sync).map((d) => d.name);
