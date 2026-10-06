import { type WeightUnit, toKg } from "@/lib/units";
import { CUSTOM, type ExerciseLog, type WorkSet, exerciseDef } from "./exercises";
import { MAX_KM } from "./workouts";

// Dal modulo (testo) ai dati salvati: numeri, kg, serie vuote tolte. Logica pura.

type FormSet = { reps: string; seconds: string; weight: string };
type FormExercise = { exercise: string; name?: string; sets: readonly FormSet[] };

/** Numero da un campo: accetta la virgola; NaN se vuoto o non valido. */
function parseNumber(text: string): number {
  const clean = text.trim().replace(",", ".");
  return clean === "" ? NaN : Number(clean);
}

function toSet(set: FormSet, mode: "reps" | "time", unit: WeightUnit): WorkSet | null {
  const count = parseNumber(mode === "time" ? set.seconds : set.reps);
  if (!Number.isInteger(count) || count < 1 || count > (mode === "time" ? 3600 : 1000)) return null;
  const out: WorkSet = mode === "time" ? { seconds: count } : { reps: count };
  const weight = parseNumber(set.weight);
  if (Number.isFinite(weight) && weight > 0) out.kg = Math.min(toKg(weight, unit), 1000);
  return out;
}

/** Esercizi da salvare: solo le serie compilate; gli esercizi senza serie spariscono. */
export function exercisesFromForm(exercises: readonly FormExercise[], unit: WeightUnit): ExerciseLog[] {
  const out: ExerciseLog[] = [];
  for (const e of exercises) {
    const mode = exerciseDef(e.exercise).mode;
    const sets = e.sets.map((s) => toSet(s, mode, unit)).filter((s): s is WorkSet => s !== null);
    if (sets.length === 0) continue;
    const name = e.exercise === CUSTOM ? e.name?.trim().slice(0, 60) : undefined;
    if (e.exercise === CUSTOM && !name) continue;
    out.push(name ? { exercise: e.exercise, name, sets } : { exercise: e.exercise, sets });
  }
  return out;
}

/** Distanza in km, o undefined se vuota o fuori dai limiti. */
export function distanceFromForm(text: string): number | undefined {
  const km = parseNumber(text);
  return Number.isFinite(km) && km > 0 && km <= MAX_KM ? Math.round(km * 100) / 100 : undefined;
}

/** "5:07" da 307 secondi. */
export function formatPace(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
