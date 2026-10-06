import * as z from "zod/mini";

// Esercizi di forza: elenco incluso nell'app (nomi nei dizionari,
// health.training.exercises), serie con ripetizioni (o secondi) e peso,
// record personali. Logica pura: si prova con Vitest.

type ExerciseGroup = "chest" | "back" | "legs" | "shoulders" | "arms" | "core" | "fullBody";

type ExerciseDef = {
  group: ExerciseGroup;
  /** "time": serie a tempo (plank), in secondi. */
  mode: "reps" | "time";
  /** "body": a corpo libero, il peso è facoltativo (zavorra). */
  load: "weight" | "body";
};

const w = (group: ExerciseGroup): ExerciseDef => ({ group, mode: "reps", load: "weight" });
const b = (group: ExerciseGroup): ExerciseDef => ({ group, mode: "reps", load: "body" });

// Gli id non si cambiano mai: stanno negli allenamenti salvati.
const EXERCISES = {
  benchPress: w("chest"),
  inclineBenchPress: w("chest"),
  dumbbellBenchPress: w("chest"),
  chestFly: w("chest"),
  pushUp: b("chest"),
  dips: b("chest"),
  deadlift: w("back"),
  pullUp: b("back"),
  latPulldown: w("back"),
  barbellRow: w("back"),
  dumbbellRow: w("back"),
  cableRow: w("back"),
  squat: w("legs"),
  frontSquat: w("legs"),
  legPress: w("legs"),
  lunge: w("legs"),
  bulgarianSplitSquat: w("legs"),
  romanianDeadlift: w("legs"),
  hipThrust: w("legs"),
  legCurl: w("legs"),
  legExtension: w("legs"),
  calfRaise: w("legs"),
  overheadPress: w("shoulders"),
  dumbbellShoulderPress: w("shoulders"),
  lateralRaise: w("shoulders"),
  rearDeltFly: w("shoulders"),
  facePull: w("shoulders"),
  bicepsCurl: w("arms"),
  hammerCurl: w("arms"),
  tricepsPushdown: w("arms"),
  skullCrusher: w("arms"),
  plank: { group: "core", mode: "time", load: "body" },
  crunch: b("core"),
  hangingLegRaise: b("core"),
  russianTwist: b("core"),
  kettlebellSwing: w("fullBody"),
  powerClean: w("fullBody"),
  thruster: w("fullBody"),
  burpee: b("fullBody"),
} as const satisfies Record<string, ExerciseDef>;

export type ExerciseId = keyof typeof EXERCISES;
const EXERCISE_IDS = Object.keys(EXERCISES) as ExerciseId[];
/** Esercizio scritto dall'utente (nome libero). */
export const CUSTOM = "custom";

export const isExerciseId = (id: string): id is ExerciseId => id in EXERCISES;
export const exerciseDef = (id: string): ExerciseDef => (isExerciseId(id) ? EXERCISES[id] : { group: "fullBody", mode: "reps", load: "weight" });

export const MAX_SETS = 30;
export const MAX_EXERCISES = 40;
const MAX_KG = 1000;

export const setSchema = z.object({
  reps: z.optional(z.int().check(z.gte(1), z.lte(1000))),
  seconds: z.optional(z.int().check(z.gte(1), z.lte(3600))),
  kg: z.optional(z.number().check(z.gte(0), z.lte(MAX_KG))),
});
export type WorkSet = z.infer<typeof setSchema>;

export const exerciseLogSchema = z.object({
  /** Id dell'elenco, oppure "custom" con il nome scritto dall'utente. */
  exercise: z.string().check(z.maxLength(40)),
  name: z.optional(z.string().check(z.trim(), z.minLength(1), z.maxLength(60))),
  sets: z.array(setSchema).check(z.maxLength(MAX_SETS)),
});
export type ExerciseLog = z.infer<typeof exerciseLogSchema>;

/** Chiave per confrontare lo stesso esercizio tra allenamenti (anche quelli scritti a mano). */
export function exerciseKey(log: Pick<ExerciseLog, "exercise" | "name">): string {
  return log.exercise === CUSTOM ? `custom:${(log.name ?? "").trim().toLocaleLowerCase()}` : log.exercise;
}

/** Serie complete: con ripetizioni (o secondi). */
export const doneSets = (sets: readonly WorkSet[]) => sets.filter((s) => (s.reps ?? 0) > 0 || (s.seconds ?? 0) > 0);

/**
 * Massimale stimato su una ripetizione (formula di Epley). Solo fino a 12
 * ripetizioni: oltre la stima non vale più. null senza peso.
 */
export function estimated1rm(set: WorkSet): number | null {
  if (!set.kg || !set.reps || set.reps > 12) return null;
  return set.reps === 1 ? set.kg : Math.round(set.kg * (1 + set.reps / 30) * 10) / 10;
}

export type ExerciseBest = { kg: number | null; e1rm: number | null; reps: number | null; seconds: number | null };

/** Il meglio di un elenco di serie: peso più alto, massimale stimato, ripetizioni o secondi. */
export function bestOf(sets: readonly WorkSet[]): ExerciseBest {
  const best: ExerciseBest = { kg: null, e1rm: null, reps: null, seconds: null };
  for (const s of doneSets(sets)) {
    if (s.kg) best.kg = Math.max(best.kg ?? 0, s.kg);
    const e = estimated1rm(s);
    if (e !== null) best.e1rm = Math.max(best.e1rm ?? 0, e);
    if (s.reps) best.reps = Math.max(best.reps ?? 0, s.reps);
    if (s.seconds) best.seconds = Math.max(best.seconds ?? 0, s.seconds);
  }
  return best;
}

type WithExercises = { id: string; day: string; at: string; exercises?: readonly ExerciseLog[] };

export type ExerciseHistory = {
  key: string;
  exercise: string;
  name?: string;
  /** Ultima volta: giorno e serie. */
  lastDay: string;
  lastSets: WorkSet[];
  sessions: number;
  best: ExerciseBest;
};

/** Storico per esercizio, dal più recente. */
export function exerciseHistory(workouts: readonly WithExercises[]): ExerciseHistory[] {
  const byKey = new Map<string, ExerciseHistory>();
  const sorted = [...workouts].sort((a, b) => a.at.localeCompare(b.at));
  for (const workout of sorted) {
    for (const log of workout.exercises ?? []) {
      const sets = doneSets(log.sets);
      if (sets.length === 0) continue;
      const key = exerciseKey(log);
      const prev = byKey.get(key);
      const best = prev ? mergeBest(prev.best, bestOf(sets)) : bestOf(sets);
      byKey.set(key, { key, exercise: log.exercise, name: log.name, lastDay: workout.day, lastSets: sets, sessions: (prev?.sessions ?? 0) + 1, best });
    }
  }
  return [...byKey.values()].sort((a, b) => b.lastDay.localeCompare(a.lastDay));
}

const maxOf = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

function mergeBest(a: ExerciseBest, b: ExerciseBest): ExerciseBest {
  return { kg: maxOf(a.kg, b.kg), e1rm: maxOf(a.e1rm, b.e1rm), reps: maxOf(a.reps, b.reps), seconds: maxOf(a.seconds, b.seconds) };
}

export type PersonalRecord = { key: string; exercise: string; name?: string; kind: "kg" | "e1rm" | "reps" | "seconds"; value: number };

/**
 * Record battuti da un allenamento rispetto a quelli precedenti. La prima volta
 * di un esercizio non conta come record (non c'è nulla da battere).
 */
export function newRecords(workout: WithExercises, previous: readonly WithExercises[]): PersonalRecord[] {
  const history = new Map(exerciseHistory(previous.filter((p) => p.id !== workout.id)).map((h) => [h.key, h]));
  const records: PersonalRecord[] = [];
  for (const log of workout.exercises ?? []) {
    const before = history.get(exerciseKey(log))?.best;
    if (!before) continue;
    const now = bestOf(log.sets);
    const base = { key: exerciseKey(log), exercise: log.exercise, name: log.name };
    // Con il peso conta il massimale stimato (o il peso, se le ripetizioni sono tante); a corpo libero ripetizioni e secondi.
    if (now.e1rm !== null && before.e1rm !== null && now.e1rm > before.e1rm) records.push({ ...base, kind: "e1rm", value: now.e1rm });
    else if (now.kg !== null && now.kg > (before.kg ?? 0)) records.push({ ...base, kind: "kg", value: now.kg });
    else if (now.kg === null && now.reps !== null && before.kg === null && now.reps > (before.reps ?? 0)) records.push({ ...base, kind: "reps", value: now.reps });
    else if (now.seconds !== null && now.seconds > (before.seconds ?? 0)) records.push({ ...base, kind: "seconds", value: now.seconds });
  }
  return records;
}

/** Volume (kg × ripetizioni) di un allenamento: un modo per confrontare le sedute. */
export function volumeKg(exercises: readonly ExerciseLog[]): number {
  let total = 0;
  for (const log of exercises) for (const s of doneSets(log.sets)) total += (s.kg ?? 0) * (s.reps ?? 0);
  return Math.round(total);
}

export const totalSets = (exercises: readonly ExerciseLog[]) => exercises.reduce((n, log) => n + doneSets(log.sets).length, 0);

// Minuscole e senza accenti (come le altre ricerche dell'app).
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

/** Esercizi dell'elenco il cui nome (nella lingua dell'app) contiene il testo. */
export function searchExercises(names: Readonly<Record<ExerciseId, string>>, query: string, limit = 8): ExerciseId[] {
  const q = fold(query.trim());
  if (q === "") return [];
  return EXERCISE_IDS.map((id) => ({ id, name: fold(names[id]) }))
    .filter((e) => e.name.includes(q))
    .sort((a, b) => Number(!a.name.startsWith(q)) - Number(!b.name.startsWith(q)) || a.name.length - b.name.length)
    .slice(0, limit)
    .map((e) => e.id);
}
