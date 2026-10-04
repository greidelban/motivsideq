import { z } from "zod";
import { brainResultSchema } from "@/lib/brain/history";
import { consentSchema, dayLogSchema, periodSchema } from "@/lib/health/cycle";
import { foodEntrySchema } from "@/lib/health/food";
import { workoutSchema } from "@/lib/health/workouts";
import { bodyWeightSchema, profileSchema } from "@/lib/profile/profile";
import type { Def, DocDef, ListDef } from "./records";

// Tutti i dati dell'utente salvati in IndexedDB, in un posto solo: la
// migrazione dal vecchio localStorage deve conoscerli tutti fin dall'avvio.
// Il nome coincide con la vecchia chiave (ritmo:v1:<nome>).
// Le impostazioni del dispositivo (sfondo, animazioni, durata del calcolo)
// restano in localStorage: sono piccole, servono subito e non vanno nel cloud.

const list = <T,>(name: string, item: z.ZodType<T>, keyOf: (item: T) => string, sync = true): ListDef<T> => ({
  kind: "list",
  name,
  item,
  keyOf,
  sync,
});

const doc = <T,>(name: string, schema: z.ZodType<T>, fallback: T, sync = true): DocDef<T> => ({
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
  // Momento dell'ultima cancellazione totale del ciclo: con l'account servirà
  // a chiedere la stessa cancellazione al server (delete_cycle_data).
  cycleWipedAt: doc("cycle-wiped-at", z.string().max(40).nullable(), null, false),
};

export const ALL_DEFS: readonly Def[] = Object.values(DEFS) as Def[];
