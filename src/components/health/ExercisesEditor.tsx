"use client";

import { useEffect, useState } from "react";
import { IconTrash } from "@/components/icons";
import { useI18n } from "@/i18n/client";
import { formatNumber, interpolate } from "@/i18n/format";
import { CUSTOM, MAX_EXERCISES, MAX_SETS, type WorkSet, doneSets, exerciseDef, exerciseHistory, exerciseKey, isExerciseId, searchExercises } from "@/lib/health/exercises";
import { workouts } from "@/lib/health/store";
import { type DraftExercise, type DraftSet, EMPTY_SET } from "@/lib/health/workout-draft";
import { pulseLight } from "@/lib/light/bus";
import { type WeightUnit, fromKg } from "@/lib/units";
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

export function ExercisesEditor({
  exercises,
  unit,
  onChange,
}: {
  exercises: DraftExercise[];
  unit: WeightUnit;
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
        <RestTimer />
      </div>
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
  const [query, setQuery] = useState("");
  const results = searchExercises(t.exercises, query);
  const typed = query.trim();
  const exact = results.some((id) => t.exercises[id].toLocaleLowerCase() === typed.toLocaleLowerCase());
  const label = (e: { exercise: string; name?: string }) => (isExerciseId(e.exercise) ? t.exercises[e.exercise] : (e.name ?? ""));

  function pick(exercise: string, name?: string) {
    onAdd(exercise, name);
    setQuery("");
  }

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
        recent.length > 0 && (
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
        )
      ) : (
        <ul className="space-y-1.5">
          {results.map((id) => (
            <li key={id}>
              <button type="button" onClick={() => pick(id)} className="card block min-h-11 w-full px-4 py-2 text-start hover:bg-[var(--control-bg-hover)]">
                <span className="block text-subhead font-semibold">{t.exercises[id]}</span>
                <span className="block text-footnote text-muted">{t.groups[exerciseDef(id).group]}</span>
              </button>
            </li>
          ))}
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
        <p className="min-w-0 flex-1 pt-2.5 text-subhead font-semibold">{name}</p>
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

const REST_OPTIONS = [60, 90, 120, 180] as const;

// Timer di recupero tra le serie: conta sull'orologio (non sui secondi passati
// in pagina), così resta giusto anche se il telefono mette in pausa la scheda.
// Alla fine: una vibrazione e un bagliore singolo (mai lampeggi).
function RestTimer() {
  const { locale, dict } = useI18n();
  const t = dict.health.training.rest;
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
    const time = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    return (
      <div className="flex items-center gap-2">
        <p className="num text-subhead font-semibold text-secondary" role="timer" aria-live="off">
          {interpolate(t.left, { time })}
        </p>
        <button type="button" className="btn btn-ghost min-h-11 px-4" onClick={() => setEndAt(null)}>
          {t.stop}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t.title}>
      {done && (
        <p className="w-full text-footnote text-success" role="status">
          {t.done}
        </p>
      )}
      <span className="text-footnote text-muted" aria-hidden="true">
        {t.title}
      </span>
      {REST_OPTIONS.map((s) => (
        <button
          key={s}
          type="button"
          className="card num min-h-11 rounded-full px-3 text-footnote text-ink-2 hover:text-ink"
          onClick={() => {
            setDone(false);
            setNow(Date.now());
            setEndAt(Date.now() + s * 1000);
          }}
        >
          {interpolate(t.start, { n: formatNumber(locale, s) })}
        </button>
      ))}
    </div>
  );
}
