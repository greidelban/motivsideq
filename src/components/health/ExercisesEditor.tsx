"use client";

import { useEffect, useState } from "react";
import { IconTrash } from "@/components/icons";
import { useI18n } from "@/i18n/client";
import { formatNumber, interpolate } from "@/i18n/format";
import {
  CUSTOM,
  EXERCISE_GROUPS,
  type ExerciseGroup,
  type ExerciseId,
  MAX_EXERCISES,
  MAX_SETS,
  type WorkSet,
  doneSets,
  exerciseDef,
  exerciseHistory,
  exerciseKey,
  exercisesIn,
  isExerciseId,
  searchExercises,
} from "@/lib/health/exercises";
import { workouts } from "@/lib/health/store";
import { REST_RANGE, trainingPrefs } from "@/lib/health/training-prefs";
import { type DraftExercise, type DraftSet, EMPTY_SET } from "@/lib/health/workout-draft";
import { pulseLight } from "@/lib/light/bus";
import { WEIGHT_UNITS, type WeightUnit, fromKg } from "@/lib/units";
import { Chip } from "./Chip";
import { useShortDate } from "./shared";

// Esercizi dell'allenamento in corso: si cercano (o si scrivono), si aggiungono
// le serie man mano, con "come l'ultima volta" e il timer di recupero.

const QUICK_LIMIT = 6;

/** "5×80 · 5×80 · 3×85 kg", "8 · 8 · 6", "45 s · 60 s". */
export function useSetsLabel(unit: WeightUnit) {
  const { locale, dict } = useI18n();
  const n = (v: number, digits = 0) => formatNumber(locale, v, digits);
  return (sets: readonly WorkSet[]) => {
    const parts = sets.map((s) =>
      s.seconds
        ? interpolate(dict.health.training.rest.start, { n: n(s.seconds) })
        : s.kg
          ? `${n(s.reps ?? 0)}×${n(fromKg(s.kg, unit), fromKg(s.kg, unit) % 1 ? 1 : 0)}`
          : n(s.reps ?? 0),
    );
    // Isolata come testo da sinistra a destra: in arabo ed ebraico "5×80 · 4×80" resta in quest'ordine.
    return `\u2066${parts.join(" · ")}${sets.some((s) => s.kg) ? ` ${unit}` : ""}\u2069`;
  };
}

/** Serie salvate → righe del modulo (nell'unità dell'utente). */
function toDraftSets(sets: readonly WorkSet[], unit: WeightUnit): DraftSet[] {
  return sets.map((s) => ({
    reps: s.reps ? String(s.reps) : "",
    seconds: s.seconds ? String(s.seconds) : "",
    weight: s.kg ? String(fromKg(s.kg, unit)) : "",
  }));
}

/** "Macchina · Petto, tricipiti": attrezzo e muscoli allenati (il principale per primo). */
function useExerciseInfo() {
  const { dict } = useI18n();
  const t = dict.health.training;
  return (id: string) => {
    const def = exerciseDef(id);
    return `${t.equipment[def.equipment]} · ${def.muscles.map((m) => t.muscles[m]).join(", ")}`;
  };
}

export function ExercisesEditor({
  exercises,
  unit,
  onUnitChange,
  onChange,
}: {
  exercises: DraftExercise[];
  unit: WeightUnit;
  onUnitChange: (unit: WeightUnit) => void;
  onChange: (exercises: DraftExercise[]) => void;
}) {
  const { dict } = useI18n();
  const t = dict.health.training.session;
  const history = exerciseHistory(workouts.use());

  function add(exercise: string, name?: string) {
    if (exercises.length >= MAX_EXERCISES) return;
    const uid = crypto.randomUUID();
    onChange([...exercises, { uid, exercise, ...(name ? { name } : {}), sets: [{ ...EMPTY_SET }] }]);
  }

  const replace = (uid: string, next: DraftExercise | null) =>
    onChange(next ? exercises.map((e) => (e.uid === uid ? next : e)) : exercises.filter((e) => e.uid !== uid));

  return (
    <section className="space-y-3" aria-labelledby="exercises-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="exercises-title" className="label mb-0">
          {t.title}
        </h3>
        <div className="flex gap-1.5" role="group" aria-label={t.unit}>
          {WEIGHT_UNITS.map((u) => (
            <Chip key={u} active={unit === u} onClick={() => onUnitChange(u)}>
              {u}
            </Chip>
          ))}
        </div>
      </div>
      <RestTimer />
      {exercises.length === 0 && <p className="text-footnote text-muted">{t.hint}</p>}
      {exercises.map((e) => (
        <ExerciseCard
          key={e.uid}
          entry={e}
          unit={unit}
          last={history.find((h) => h.key === exerciseKey(e))}
          onChange={(next) => replace(e.uid, next)}
        />
      ))}
      <ExerciseSearch
        recent={history
          .filter((h) => !exercises.some((e) => exerciseKey(e) === h.key))
          .slice(0, QUICK_LIMIT)
          .map((h) => ({ exercise: h.exercise, name: h.name }))}
        onAdd={add}
      />
    </section>
  );
}

function ExerciseSearch({ recent, onAdd }: { recent: { exercise: string; name?: string }[]; onAdd: (exercise: string, name?: string) => void }) {
  const { dict } = useI18n();
  const t = dict.health.training;
  const info = useExerciseInfo();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<ExerciseGroup | null>(null);
  const results = searchExercises(t.exercises, query, 12, { muscles: t.muscles, equipment: t.equipment });
  const typed = query.trim();
  const exact = results.some((id) => t.exercises[id].toLocaleLowerCase() === typed.toLocaleLowerCase());
  const label = (e: { exercise: string; name?: string }) => (isExerciseId(e.exercise) ? t.exercises[e.exercise] : (e.name ?? ""));

  function pick(exercise: string, name?: string) {
    onAdd(exercise, name);
    setQuery("");
    setGroup(null);
  }

  const resultList = (ids: readonly ExerciseId[]) =>
    ids.map((id) => (
      <li key={id}>
        <button type="button" onClick={() => pick(id)} className="card block min-h-11 w-full px-4 py-2 text-start hover:bg-[var(--control-bg-hover)]">
          <span className="block text-subhead font-semibold">{t.exercises[id]}</span>
          <span className="block text-footnote text-muted">{info(id)}</span>
        </button>
      </li>
    ));

  return (
    <div className="card space-y-2 px-3 py-3">
      <label htmlFor="exercise-search" className="label">
        {t.session.search}
      </label>
      <input
        id="exercise-search"
        type="search"
        className="field"
        autoComplete="off"
        maxLength={60}
        placeholder={t.session.placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {typed === "" ? (
        <>
          {recent.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {recent.map((e) => (
                <button
                  key={exerciseKey(e)}
                  type="button"
                  onClick={() => pick(e.exercise, e.name)}
                  className="card min-h-11 max-w-full truncate rounded-full px-3.5 text-subhead text-ink-2 hover:text-ink"
                >
                  + {label(e)}
                </button>
              ))}
            </div>
          )}
          {/* Senza scrivere nulla: si sfoglia per parte del corpo. */}
          <fieldset className="pt-1">
            <legend className="mb-2 text-footnote text-muted">{t.session.browse}</legend>
            <div className="flex flex-wrap gap-2">
              {EXERCISE_GROUPS.map((g) => (
                <Chip key={g} active={group === g} onClick={() => setGroup(group === g ? null : g)}>
                  {t.groups[g]}
                </Chip>
              ))}
            </div>
          </fieldset>
          {group && <ul className="space-y-1.5">{resultList(exercisesIn(group))}</ul>}
        </>
      ) : (
        <ul className="space-y-1.5">
          {resultList(results)}
          {!exact && (
            <li>
              <button type="button" onClick={() => pick(CUSTOM, typed.slice(0, 60))} className="link min-h-11 text-start text-subhead">
                {interpolate(t.session.custom, { name: typed })}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function ExerciseCard({
  entry,
  unit,
  last,
  onChange,
}: {
  entry: DraftExercise;
  unit: WeightUnit;
  last: { lastDay: string; lastSets: WorkSet[] } | undefined;
  onChange: (next: DraftExercise | null) => void;
}) {
  const { dict } = useI18n();
  const t = dict.health.training;
  const def = exerciseDef(entry.exercise);
  const info = useExerciseInfo();
  const timed = def.mode === "time";
  const name = isExerciseId(entry.exercise) ? t.exercises[entry.exercise] : (entry.name ?? "");
  const shortDate = useShortDate();
  const setsLabel = useSetsLabel(unit);
  const noneDone = doneSets(entry.sets.map((s) => ({ reps: Number(s.reps) || undefined, seconds: Number(s.seconds) || undefined }))).length === 0;

  const setRow = (i: number, patch: Partial<DraftSet>) => onChange({ ...entry, sets: entry.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  // Una serie nuova copia la precedente: di solito si ripete lo stesso peso.
  const addSet = () => entry.sets.length < MAX_SETS && onChange({ ...entry, sets: [...entry.sets, { ...(entry.sets.at(-1) ?? EMPTY_SET) }] });
  const removeSet = (i: number) => onChange({ ...entry, sets: entry.sets.filter((_, j) => j !== i) });
  const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

  return (
    <div className="card space-y-3 px-3 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 pt-2.5">
          <p className="text-subhead font-semibold">{name}</p>
          {isExerciseId(entry.exercise) && <p className="text-footnote text-muted">{info(entry.exercise)}</p>}
        </div>
        <button
          type="button"
          aria-label={interpolate(t.session.remove, { name })}
          onClick={() => onChange(null)}
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-[var(--control-bg)] hover:text-error"
        >
          <IconTrash width={18} height={18} />
        </button>
      </div>

      {last && (
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <p className="min-w-0 text-footnote text-muted">{interpolate(t.session.last, { date: shortDate(last.lastDay), sets: setsLabel(last.lastSets) })}</p>
          {noneDone && (
            <button type="button" className="link min-h-11 text-footnote" onClick={() => onChange({ ...entry, sets: toDraftSets(last.lastSets, unit) })}>
              {t.session.repeatLast}
            </button>
          )}
        </div>
      )}

      <ol className="space-y-2">
        {entry.sets.map((s, i) => {
          const n = i + 1;
          const countId = `${entry.uid}-${i}-count`;
          const weightId = `${entry.uid}-${i}-weight`;
          return (
            <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-end gap-2">
              <span className="num pb-3 text-center text-footnote text-muted" aria-hidden="true">
                {n}
              </span>
              <div>
                <label htmlFor={countId} className="label truncate text-caption">
                  <span className="sr-only">{interpolate(t.session.set, { n })} · </span>
                  {timed ? t.session.seconds : t.session.reps}
                </label>
                <input
                  id={countId}
                  className="field num"
                  inputMode="numeric"
                  value={timed ? s.seconds : s.reps}
                  onChange={(e) => setRow(i, timed ? { seconds: digits(e.target.value, 4) } : { reps: digits(e.target.value, 4) })}
                />
              </div>
              <div>
                <label htmlFor={weightId} className="label truncate text-caption">
                  <span className="sr-only">{interpolate(t.session.set, { n })} · </span>
                  {interpolate(def.load === "body" ? t.session.extraWeight : t.session.weight, { unit })}
                </label>
                <input
                  id={weightId}
                  className="field num"
                  inputMode="decimal"
                  value={s.weight}
                  onChange={(e) => setRow(i, { weight: e.target.value.replace(/[^\d.,]/g, "").slice(0, 7) })}
                />
              </div>
              <button
                type="button"
                aria-label={interpolate(t.session.removeSet, { n })}
                disabled={entry.sets.length === 1}
                onClick={() => removeSet(i)}
                className="grid size-11 place-items-center rounded-full text-title3 text-muted hover:bg-[var(--control-bg)] disabled:opacity-30"
              >
                <span aria-hidden="true">−</span>
              </button>
            </li>
          );
        })}
      </ol>
      <button type="button" className="btn btn-ghost w-full" disabled={entry.sets.length >= MAX_SETS} onClick={addSet}>
        + {t.session.addSet}
      </button>
    </div>
  );
}

/** "1:30", "0:45". */
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// Timer di recupero tra le serie: la durata si sceglie con un cursore (da 15 s
// a 5 min, ricordata su questo telefono). Conta sull'orologio (non sui secondi
// passati in pagina), così resta giusto anche se il telefono mette in pausa la
// scheda. Alla fine: una vibrazione e un bagliore singolo (mai lampeggi).
function RestTimer() {
  const { dict } = useI18n();
  const t = dict.health.training.rest;
  const rest = trainingPrefs.use().rest;
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState(false);
  const left = endAt === null ? 0 : Math.max(0, Math.ceil((endAt - now) / 1000));

  useEffect(() => {
    if (endAt === null) return;
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endAt) {
        setEndAt(null);
        setDone(true);
        navigator.vibrate?.([200, 100, 200]);
        pulseLight(0.3);
      }
    }, 250);
    return () => clearInterval(id);
  }, [endAt]);

  if (endAt !== null) {
    return (
      <div className="card flex flex-wrap items-center gap-2 px-3 py-2">
        <p className="num flex-1 text-subhead font-semibold text-secondary" role="timer" aria-live="off">
          {interpolate(t.left, { time: clock(left) })}
        </p>
        <button type="button" className="btn btn-ghost min-h-11 px-4" onClick={() => setEndAt(endAt + REST_RANGE.step * 1000)}>
          <span dir="ltr">{t.more}</span>
        </button>
        <button type="button" className="btn btn-ghost min-h-11 px-4" onClick={() => setEndAt(null)}>
          {t.stop}
        </button>
      </div>
    );
  }

  return (
    <div className="card space-y-1 px-3 py-2">
      {done && (
        <p className="text-footnote text-success" role="status">
          {t.done}
        </p>
      )}
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="rest-length" className="text-footnote text-muted">
          {t.length}
        </label>
        <span className="num text-subhead font-semibold" aria-hidden="true">
          {clock(rest)}
        </span>
      </div>
      <input
        id="rest-length"
        type="range"
        className="motion-range w-full"
        min={REST_RANGE.min}
        max={REST_RANGE.max}
        step={REST_RANGE.step}
        value={rest}
        aria-valuetext={clock(rest)}
        onChange={(e) => trainingPrefs.set({ ...trainingPrefs.get(), rest: Number(e.target.value) })}
      />
      <button
        type="button"
        className="btn btn-primary w-full"
        onClick={() => {
          setDone(false);
          setNow(Date.now());
          setEndAt(Date.now() + rest * 1000);
        }}
      >
        {interpolate(t.go, { time: clock(rest) })}
      </button>
    </div>
  );
}
