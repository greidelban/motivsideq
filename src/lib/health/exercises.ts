import * as z from "zod/mini";

// Esercizi di forza: elenco incluso nell'app (nomi nei dizionari,
// health.training.exercises), serie con ripetizioni (o secondi) e peso,
// record personali. Logica pura: si prova con Vitest.

export const EXERCISE_GROUPS = ["chest", "back", "legs", "shoulders", "arms", "core", "fullBody"] as const;
export type ExerciseGroup = (typeof EXERCISE_GROUPS)[number];

/** Muscoli allenati: il primo è il principale. Nomi in health.training.muscles. */
export const MUSCLES = [
  "chest",
  "frontDelts",
  "sideDelts",
  "rearDelts",
  "triceps",
  "biceps",
  "forearms",
  "lats",
  "upperBack",
  "traps",
  "lowerBack",
  "abs",
  "obliques",
  "glutes",
  "quads",
  "hamstrings",
  "adductors",
  "abductors",
  "calves",
] as const;
export type Muscle = (typeof MUSCLES)[number];

/** Attrezzo (nomi in health.training.equipment): "machine" sono i macchinari della palestra. */
export const EQUIPMENT = ["barbell", "dumbbell", "machine", "cable", "kettlebell", "bodyweight", "other"] as const;
export type Equipment = (typeof EQUIPMENT)[number];

type ExerciseDef = {
  group: ExerciseGroup;
  /** "time": serie a tempo (plank), in secondi. */
  mode: "reps" | "time";
  /** "body": a corpo libero, il peso è facoltativo (zavorra). */
  load: "weight" | "body";
  muscles: readonly [Muscle, ...Muscle[]];
  equipment: Equipment;
  /** Altri nomi per la ricerca (gergo da palestra, spesso inglese o italiano): non si mostrano. */
  aliases?: readonly string[];
};

type Extra = { aliases?: readonly string[]; equipment?: Equipment; mode?: ExerciseDef["mode"] };
const w = (group: ExerciseGroup, muscles: ExerciseDef["muscles"], equipment: Equipment, extra: Extra = {}): ExerciseDef => ({
  group,
  mode: "reps",
  load: "weight",
  muscles,
  equipment,
  ...extra,
});
const b = (group: ExerciseGroup, muscles: ExerciseDef["muscles"], extra: Extra = {}): ExerciseDef => ({
  group,
  mode: "reps",
  load: "body",
  muscles,
  equipment: "bodyweight",
  ...extra,
});
/** Serie a tempo (secondi). */
const T = { mode: "time" } as const;

// Gli id non si cambiano mai: stanno negli allenamenti salvati. I nuovi vanno in coda.
const EXERCISES = {
  benchPress: w("chest", ["chest", "triceps", "frontDelts"], "barbell", { aliases: ["bench", "panca piana"] }),
  inclineBenchPress: w("chest", ["chest", "frontDelts", "triceps"], "barbell", { aliases: ["panca inclinata"] }),
  dumbbellBenchPress: w("chest", ["chest", "triceps", "frontDelts"], "dumbbell", { aliases: ["db bench", "panca manubri"] }),
  chestFly: w("chest", ["chest", "frontDelts"], "dumbbell", { aliases: ["flyes", "croci"] }),
  pushUp: b("chest", ["chest", "triceps", "frontDelts"], { aliases: ["press up", "piegamenti", "flessioni"] }),
  dips: b("chest", ["chest", "triceps", "frontDelts"], { aliases: ["parallele"] }),
  deadlift: w("back", ["glutes", "hamstrings", "lowerBack", "traps"], "barbell", { aliases: ["stacco"] }),
  pullUp: b("back", ["lats", "biceps", "upperBack"], { aliases: ["trazioni", "pull up"] }),
  latPulldown: w("back", ["lats", "biceps", "upperBack"], "machine", { aliases: ["lat machine", "lat pull"] }),
  barbellRow: w("back", ["upperBack", "lats", "rearDelts", "biceps"], "barbell", { aliases: ["bent over row", "rematore"] }),
  dumbbellRow: w("back", ["lats", "upperBack", "biceps"], "dumbbell", { aliases: ["one arm row", "rematore manubrio"] }),
  cableRow: w("back", ["upperBack", "lats", "biceps"], "cable", { aliases: ["seated row", "pulley"] }),
  squat: w("legs", ["quads", "glutes", "adductors", "lowerBack"], "barbell", { aliases: ["back squat"] }),
  frontSquat: w("legs", ["quads", "glutes", "abs"], "barbell"),
  legPress: w("legs", ["quads", "glutes", "hamstrings"], "machine", { aliases: ["pressa"] }),
  lunge: w("legs", ["quads", "glutes", "hamstrings"], "dumbbell", { aliases: ["affondi"] }),
  bulgarianSplitSquat: w("legs", ["quads", "glutes"], "dumbbell", { aliases: ["split squat"] }),
  romanianDeadlift: w("legs", ["hamstrings", "glutes", "lowerBack"], "barbell", { aliases: ["rdl", "stacco rumeno"] }),
  hipThrust: w("legs", ["glutes", "hamstrings"], "barbell", { aliases: ["ponte glutei", "glute bridge"] }),
  legCurl: w("legs", ["hamstrings"], "machine"),
  legExtension: w("legs", ["quads"], "machine"),
  calfRaise: w("legs", ["calves"], "machine", { aliases: ["polpacci"] }),
  overheadPress: w("shoulders", ["frontDelts", "sideDelts", "triceps"], "barbell", {
    aliases: ["military press", "ohp", "shoulder press", "lento avanti", "press militar", "developpe militaire"],
  }),
  dumbbellShoulderPress: w("shoulders", ["frontDelts", "sideDelts", "triceps"], "dumbbell", { aliases: ["military press", "lento manubri"] }),
  lateralRaise: w("shoulders", ["sideDelts"], "dumbbell", { aliases: ["alzate laterali"] }),
  rearDeltFly: w("shoulders", ["rearDelts", "upperBack"], "dumbbell", { aliases: ["reverse fly", "alzate posteriori"] }),
  facePull: w("shoulders", ["rearDelts", "upperBack", "traps"], "cable"),
  bicepsCurl: w("arms", ["biceps", "forearms"], "dumbbell", { aliases: ["curl"] }),
  hammerCurl: w("arms", ["biceps", "forearms"], "dumbbell", { aliases: ["curl martello"] }),
  tricepsPushdown: w("arms", ["triceps"], "cable", { aliases: ["pushdown", "push down"] }),
  skullCrusher: w("arms", ["triceps"], "barbell", { aliases: ["french press"] }),
  plank: b("core", ["abs", "obliques"], T),
  crunch: b("core", ["abs"]),
  hangingLegRaise: b("core", ["abs", "obliques"]),
  russianTwist: b("core", ["obliques", "abs"]),
  kettlebellSwing: w("fullBody", ["glutes", "hamstrings", "lowerBack"], "kettlebell"),
  powerClean: w("fullBody", ["glutes", "quads", "hamstrings", "traps"], "barbell", { aliases: ["girata"] }),
  thruster: w("fullBody", ["quads", "glutes", "frontDelts", "triceps"], "barbell"),
  burpee: b("fullBody", ["quads", "chest", "abs"]),
  // Aggiunti il 6/10/2026.
  declineBenchPress: w("chest", ["chest", "triceps"], "barbell", { aliases: ["panca declinata"] }),
  inclineDumbbellPress: w("chest", ["chest", "frontDelts", "triceps"], "dumbbell", { aliases: ["panca inclinata manubri"] }),
  machineChestPress: w("chest", ["chest", "triceps", "frontDelts"], "machine", { aliases: ["chest press"] }),
  pecDeck: w("chest", ["chest"], "machine", { aliases: ["butterfly", "pec deck", "peck deck"] }),
  cableCrossover: w("chest", ["chest", "frontDelts"], "cable", { aliases: ["crossover", "croci ai cavi"] }),
  chinUp: b("back", ["lats", "biceps"], { aliases: ["chin up", "trazioni supine"] }),
  tBarRow: w("back", ["upperBack", "lats", "biceps"], "barbell", { aliases: ["t bar", "rematore t"] }),
  machineRow: w("back", ["upperBack", "lats", "biceps"], "machine", { aliases: ["row machine", "rematore macchina"] }),
  straightArmPulldown: w("back", ["lats"], "cable", { aliases: ["pullover"] }),
  shrug: w("back", ["traps"], "dumbbell", { aliases: ["scrollate"] }),
  backExtension: w("back", ["lowerBack", "glutes", "hamstrings"], "machine", { aliases: ["hyperextension", "iperestensioni"] }),
  invertedRow: b("back", ["upperBack", "lats", "biceps"], { aliases: ["australian pull up", "rematore inverso"] }),
  muscleUp: b("back", ["lats", "chest", "triceps"], { aliases: ["muscle up"] }),
  frontLever: b("back", ["lats", "abs"], T),
  hackSquat: w("legs", ["quads", "glutes"], "machine", { aliases: ["hack"] }),
  smithSquat: w("legs", ["quads", "glutes"], "machine", { aliases: ["smith", "multipower"] }),
  gobletSquat: w("legs", ["quads", "glutes"], "dumbbell"),
  sumoDeadlift: w("legs", ["glutes", "adductors", "hamstrings", "quads"], "barbell", { aliases: ["stacco sumo"] }),
  goodMorning: w("legs", ["hamstrings", "lowerBack", "glutes"], "barbell"),
  stepUp: w("legs", ["quads", "glutes"], "dumbbell"),
  hipAbduction: w("legs", ["abductors", "glutes"], "machine", { aliases: ["abductor", "abduttori"] }),
  hipAdduction: w("legs", ["adductors"], "machine", { aliases: ["adductor", "adduttori"] }),
  seatedCalfRaise: w("legs", ["calves"], "machine", { aliases: ["polpacci"] }),
  gluteKickback: w("legs", ["glutes"], "cable", { aliases: ["kickback", "slanci"] }),
  pistolSquat: b("legs", ["quads", "glutes"], { aliases: ["pistol"] }),
  jumpSquat: b("legs", ["quads", "glutes", "calves"]),
  boxJump: b("legs", ["quads", "glutes", "calves"]),
  wallSit: b("legs", ["quads"], { ...T, aliases: ["sedia al muro"] }),
  nordicCurl: b("legs", ["hamstrings"], { aliases: ["nordic"] }),
  machineShoulderPress: w("shoulders", ["frontDelts", "sideDelts", "triceps"], "machine", { aliases: ["shoulder press"] }),
  arnoldPress: w("shoulders", ["frontDelts", "sideDelts", "triceps"], "dumbbell", { aliases: ["arnold"] }),
  frontRaise: w("shoulders", ["frontDelts"], "dumbbell", { aliases: ["alzate frontali"] }),
  uprightRow: w("shoulders", ["sideDelts", "traps"], "barbell", { aliases: ["tirate al mento"] }),
  cableLateralRaise: w("shoulders", ["sideDelts"], "cable", { aliases: ["alzate laterali cavo"] }),
  pikePushUp: b("shoulders", ["frontDelts", "triceps"], { aliases: ["pike"] }),
  handstandPushUp: b("shoulders", ["frontDelts", "triceps", "traps"], { aliases: ["hspu", "verticale"] }),
  handstand: b("shoulders", ["frontDelts", "triceps", "abs"], { ...T, aliases: ["verticale"] }),
  barbellCurl: w("arms", ["biceps", "forearms"], "barbell", { aliases: ["curl bilanciere"] }),
  preacherCurl: w("arms", ["biceps"], "barbell", { aliases: ["panca scott", "scott"] }),
  cableCurl: w("arms", ["biceps"], "cable"),
  concentrationCurl: w("arms", ["biceps"], "dumbbell"),
  overheadTricepsExtension: w("arms", ["triceps"], "dumbbell", { aliases: ["french press", "estensioni"] }),
  closeGripBenchPress: w("arms", ["triceps", "chest"], "barbell", { aliases: ["panca presa stretta"] }),
  benchDips: b("arms", ["triceps"], { aliases: ["dip panca"] }),
  wristCurl: w("arms", ["forearms"], "dumbbell", { aliases: ["avambracci"] }),
  cableCrunch: w("core", ["abs"], "cable"),
  abCrunchMachine: w("core", ["abs"], "machine", { aliases: ["ab machine"] }),
  abWheel: b("core", ["abs", "lowerBack"], { equipment: "other", aliases: ["ab roller", "rotella"] }),
  legRaise: b("core", ["abs"]),
  sidePlank: b("core", ["obliques", "abs"], T),
  mountainClimber: b("core", ["abs", "quads"]),
  hollowHold: b("core", ["abs"], { ...T, aliases: ["hollow body"] }),
  lSit: b("core", ["abs", "triceps"], { ...T, aliases: ["l sit"] }),
  wallBall: w("fullBody", ["quads", "glutes", "frontDelts"], "other"),
  snatch: w("fullBody", ["glutes", "quads", "traps", "frontDelts"], "barbell", { aliases: ["strappo"] }),
  farmerWalk: w("fullBody", ["forearms", "traps", "abs"], "dumbbell", { ...T, aliases: ["farmer", "camminata del contadino"] }),
  sledPush: w("fullBody", ["quads", "glutes", "calves"], "other", { aliases: ["slitta", "prowler"] }),
  battleRopes: b("fullBody", ["frontDelts", "abs", "forearms"], { ...T, equipment: "other", aliases: ["corde"] }),
  turkishGetUp: w("fullBody", ["frontDelts", "abs", "glutes"], "kettlebell", { aliases: ["tgu"] }),
  jumpRope: b("fullBody", ["calves", "quads"], { ...T, equipment: "other", aliases: ["corda", "salto della corda"] }),
} as const satisfies Record<string, ExerciseDef>;

export type ExerciseId = keyof typeof EXERCISES;
const EXERCISE_IDS = Object.keys(EXERCISES) as ExerciseId[];
/** Esercizio scritto dall'utente (nome libero). */
export const CUSTOM = "custom";

export const isExerciseId = (id: string): id is ExerciseId => id in EXERCISES;
const CUSTOM_DEF: ExerciseDef = { group: "fullBody", mode: "reps", load: "weight", muscles: ["abs"], equipment: "other" };
export const exerciseDef = (id: string): ExerciseDef => (isExerciseId(id) ? EXERCISES[id] : CUSTOM_DEF);

/** Esercizi di un gruppo, nell'ordine dell'elenco. */
export const exercisesIn = (group: ExerciseGroup): ExerciseId[] => EXERCISE_IDS.filter((id) => EXERCISES[id].group === group);

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

/** Nomi nella lingua dell'app usati dalla ricerca, oltre a quelli degli esercizi. */
export type ExerciseLabels = { muscles: Readonly<Record<Muscle, string>>; equipment: Readonly<Record<Equipment, string>> };

/**
 * Esercizi dell'elenco che corrispondono al testo: prima per nome (nella lingua
 * dell'app) o per un altro nome ("military press"), poi per muscolo o attrezzo
 * ("tricipiti", "macchina").
 */
export function searchExercises(names: Readonly<Record<ExerciseId, string>>, query: string, limit = 8, labels?: ExerciseLabels): ExerciseId[] {
  const q = fold(query.trim());
  if (q === "") return [];
  const found: { id: ExerciseId; rank: number; length: number }[] = [];
  for (const id of EXERCISE_IDS) {
    const def: ExerciseDef = EXERCISES[id];
    const name = fold(names[id]);
    const muscle = labels ? def.muscles.findIndex((m) => fold(labels.muscles[m]).includes(q)) : -1;
    let rank: number;
    if (name.startsWith(q)) rank = 0;
    else if (name.includes(q)) rank = 1;
    else if ((def.aliases ?? []).some((a) => fold(a).includes(q))) rank = 2;
    // Prima gli esercizi in cui quel muscolo è il principale.
    else if (muscle >= 0) rank = 3 + muscle / 10;
    else if (labels && fold(labels.equipment[def.equipment]).includes(q)) rank = 4;
    else continue;
    found.push({ id, rank, length: name.length });
  }
  return found
    .sort((a, b) => a.rank - b.rank || a.length - b.length)
    .slice(0, limit)
    .map((e) => e.id);
}
