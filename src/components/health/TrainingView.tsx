"use client";

import { type FormEvent, useState } from "react";
import { Segmented } from "@/components/brain/Segmented";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { formatNumber, interpolate, plural } from "@/i18n/format";
import { localDateKey } from "@/lib/dates";
import { type ExerciseLog, type PersonalRecord, exerciseHistory, isExerciseId, newRecords, totalSets, volumeKg } from "@/lib/health/exercises";
import { addWorkout, workouts } from "@/lib/health/store";
import { type WorkoutDraft, workoutDraft } from "@/lib/health/workout-draft";
import { distanceFromForm, exercisesFromForm, formatPace } from "@/lib/health/workout-form";
import {
  type Intensity,
  MAX_MINUTES,
  WORKOUT_CATEGORIES,
  type Workout,
  type WorkoutType,
  distanceMode,
  hasExercises,
  paceOrSpeed,
  sortRecent,
  typesIn,
  weekSummary,
  workoutKcal,
} from "@/lib/health/workouts";
import { pulseLight } from "@/lib/light/bus";
import { latestWeight } from "@/lib/profile/profile";
import { bodyWeights, profile } from "@/lib/profile/store";
import { useLocalData } from "@/lib/storage/db";
import { type WeightUnit, fromKg } from "@/lib/units";
import { Chip, Notice } from "./Chip";
import { ExercisesEditor, useSetsLabel } from "./ExercisesEditor";
import { DeleteButton, ProfileMissing, useShortDate } from "./shared";

const INTENSITY_KEYS = { 1: "light", 2: "moderate", 3: "hard" } as const;
const HISTORY_LIMIT = 30;
const PROGRESS_LIMIT = 8;

export function TrainingView() {
  const hydrated = useLocalData();
  if (!hydrated) return <div className="min-h-96" />;
  return <Training />;
}

/** Nome di un esercizio: dall'elenco (nella lingua dell'app) o quello scritto dall'utente. */
function useExerciseName() {
  const { dict } = useI18n();
  return (log: { exercise: string; name?: string }) => (isExerciseId(log.exercise) ? dict.health.training.exercises[log.exercise] : (log.name ?? ""));
}

function Training() {
  const { locale, dict } = useI18n();
  const t = dict.health.training;
  const list = workouts.use();
  const weight = latestWeight(bodyWeights.use())?.kg ?? null;
  const today = localDateKey();
  const week = weekSummary(list, weight, today);

  return (
    <>
      <Panel>
        <h2 className="eyebrow mb-3">{t.week.title}</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat value={formatNumber(locale, week.sessions)} label={t.week.stats.sessions} />
          <Stat value={formatNumber(locale, week.minutes)} label={t.week.stats.minutes} />
          <Stat value={week.kcal === null ? "–" : formatNumber(locale, week.kcal)} label={t.week.stats.kcal} />
        </div>
        <p className="mt-3 text-footnote text-muted">{plural(locale, week.activeDays, t.week.activeDays)}</p>
        {weight === null && <ProfileMissing missing={["weight"]} />}
      </Panel>

      <LogWorkout weight={weight} today={today} />
      <Progress list={list} />
      <History list={list} weight={weight} />
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card px-2 py-3">
      <p className="num text-title2 font-semibold">{value}</p>
      <p className="truncate text-caption text-muted">{label}</p>
    </div>
  );
}

const newDraft = (today: string, type: WorkoutType = "gym"): WorkoutDraft => ({
  type,
  minutes: "45",
  intensity: 2,
  day: today,
  note: "",
  distance: "",
  exercises: [],
});

function LogWorkout({ weight, today }: { weight: number | null; today: string }) {
  const { locale, dict } = useI18n();
  const t = dict.health.training;
  const unit = profile.use().weightUnit ?? "kg";
  const stored = workoutDraft.use();
  const draft = stored ?? newDraft(today);
  const type = draft.type as WorkoutType;
  const [status, setStatus] = useState<"saved" | "invalid" | null>(null);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const name = useExerciseName();

  // Ogni modifica finisce subito nella bozza: l'allenamento in corso non si perde.
  const update = (patch: Partial<WorkoutDraft>) => {
    workoutDraft.set({ ...(workoutDraft.get() ?? newDraft(today)), ...patch });
    setStatus(null);
    setRecords([]);
  };

  const mins = Number(draft.minutes);
  const validMinutes = Number.isInteger(mins) && mins >= 1 && mins <= MAX_MINUTES;
  const estimate = validMinutes ? workoutKcal({ type, minutes: mins, intensity: draft.intensity }, weight) : null;
  const km = distanceMode(type) ? distanceFromForm(draft.distance) : undefined;
  const pace = validMinutes ? paceOrSpeed(type, mins, km) : null;

  function save(e: FormEvent) {
    e.preventDefault();
    if (!validMinutes || !draft.day || draft.day > today) {
      setStatus("invalid");
      return;
    }
    const exercises = hasExercises(type) ? exercisesFromForm(draft.exercises, unit) : [];
    const previous = workouts.get();
    const saved = addWorkout({
      type,
      minutes: mins,
      intensity: draft.intensity,
      day: draft.day,
      note: draft.note.trim() || undefined,
      ...(exercises.length > 0 ? { exercises } : {}),
      ...(km !== undefined ? { distanceKm: km } : {}),
    });
    const beaten = newRecords(saved, previous);
    pulseLight(beaten.length > 0 ? 1 : 0.6);
    // Si riparte pulito, con lo stesso tipo di allenamento.
    workoutDraft.set(newDraft(today, type));
    setRecords(beaten);
    setStatus("saved");
  }

  const recordText = (r: PersonalRecord) => {
    const vars = { name: name(r) };
    if (r.kind === "e1rm" || r.kind === "kg")
      return interpolate(t.records[r.kind], { ...vars, n: weightText(locale, r.value, unit), unit });
    return interpolate(t.records[r.kind], { ...vars, n: formatNumber(locale, r.value) });
  };

  return (
    <Panel>
      <h2 className="mb-4 text-headline font-semibold">{t.log.title}</h2>
      <form onSubmit={save} className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="label">{t.log.type}</legend>
          {WORKOUT_CATEGORIES.map((category) => (
            <div key={category}>
              <p className="eyebrow mb-2">{t.categories[category]}</p>
              <div className="flex flex-wrap gap-2">
                {typesIn(category).map((id) => (
                  <Chip key={id} active={type === id} onClick={() => update({ type: id })}>
                    {t.types[id]}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </fieldset>

        {hasExercises(type) && <ExercisesEditor exercises={draft.exercises} unit={unit} onChange={(exercises) => update({ exercises })} />}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="workout-minutes" className="label">
              {t.log.duration}
            </label>
            <input
              id="workout-minutes"
              className="field num"
              inputMode="numeric"
              value={draft.minutes}
              aria-invalid={status === "invalid" && !validMinutes ? true : undefined}
              onChange={(e) => update({ minutes: e.target.value.replace(/\D/g, "").slice(0, 3) })}
            />
          </div>
          <div>
            <label htmlFor="workout-day" className="label">
              {dict.health.day}
            </label>
            <input id="workout-day" type="date" className="field" value={draft.day} max={today} onChange={(e) => update({ day: e.target.value })} />
          </div>
        </div>

        {distanceMode(type) && (
          <div>
            <label htmlFor="workout-distance" className="label">
              {t.distance.label}
            </label>
            <input
              id="workout-distance"
              className="field num"
              inputMode="decimal"
              value={draft.distance}
              onChange={(e) => update({ distance: e.target.value.replace(/[^\d.,]/g, "").slice(0, 7) })}
            />
            {pace && (
              <p className="mt-1.5 text-footnote text-ink-2" aria-live="polite">
                {pace.kind === "pace"
                  ? interpolate(t.distance.pace, { pace: formatPace(pace.secondsPerKm) })
                  : interpolate(t.distance.speed, { n: formatNumber(locale, pace.kmh, 1) })}
              </p>
            )}
          </div>
        )}

        <Segmented
          label={t.log.intensity}
          value={draft.intensity}
          onChange={(intensity: Intensity) => update({ intensity })}
          options={([1, 2, 3] as const).map((v) => ({ value: v, label: t.log.intensities[INTENSITY_KEYS[v]] }))}
        />

        <div>
          <label htmlFor="workout-note" className="label">
            {t.log.note} <span className="text-muted">({dict.common.optional})</span>
          </label>
          <input
            id="workout-note"
            className="field"
            maxLength={200}
            placeholder={t.log.notePlaceholder}
            value={draft.note}
            onChange={(e) => update({ note: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="num text-subhead text-ink-2">{estimate !== null && interpolate(t.log.estimate, { n: formatNumber(locale, estimate) })}</p>
          <button type="submit" className="btn btn-primary">
            {t.log.save}
          </button>
        </div>
        {status === "saved" && <Notice tone="success">{t.log.saved}</Notice>}
        {records.length > 0 && (
          <div className="card px-4 py-3" role="status">
            <p className="text-headline font-semibold text-secondary">{t.records.title}</p>
            <ul className="mt-1 space-y-0.5 text-subhead">
              {records.map((r) => (
                <li key={r.key}>{recordText(r)}</li>
              ))}
            </ul>
          </div>
        )}
        {status === "invalid" && <Notice tone="error">{interpolate(t.log.invalidMinutes, { max: MAX_MINUTES })}</Notice>}
        {stored && (stored.exercises.length > 0 || stored.note || stored.distance) && (
          <button type="button" className="link min-h-11 text-footnote" onClick={() => workoutDraft.set(newDraft(today, type))}>
            {t.session.discard}
          </button>
        )}
      </form>
    </Panel>
  );
}

// "I tuoi esercizi": ultima volta e record di ogni esercizio, dal più recente.
function Progress({ list }: { list: readonly Workout[] }) {
  const { locale, dict } = useI18n();
  const t = dict.health.training.progress;
  const unit = profile.use().weightUnit ?? "kg";
  const shortDate = useShortDate();
  const name = useExerciseName();
  const setsLabel = useSetsLabel(unit);
  const history = exerciseHistory(list).slice(0, PROGRESS_LIMIT);
  if (history.length === 0) return null;
  const kg = (v: number) => weightText(locale, v, unit);

  return (
    <Panel>
      <h2 className="mb-3 text-headline font-semibold">{t.title}</h2>
      <ul className="space-y-2">
        {history.map((h) => (
          <li key={h.key} className="card px-4 py-2.5">
            <p className="truncate text-subhead font-semibold">{name(h)}</p>
            <p className="truncate text-footnote text-muted">{interpolate(t.last, { date: shortDate(h.lastDay), sets: setsLabel(h.lastSets) })}</p>
            <p className="truncate text-footnote text-ink-2">
              {h.best.kg !== null && h.best.e1rm !== null
                ? interpolate(t.best, { kg: kg(h.best.kg), e1rm: kg(h.best.e1rm), unit })
                : h.best.kg !== null
                  ? interpolate(t.bestKg, { kg: kg(h.best.kg), unit })
                  : h.best.reps !== null
                    ? interpolate(t.bestReps, { n: formatNumber(locale, h.best.reps) })
                    : interpolate(t.bestSeconds, { n: formatNumber(locale, h.best.seconds ?? 0) })}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function History({ list, weight }: { list: readonly Workout[]; weight: number | null }) {
  const { locale, dict } = useI18n();
  const t = dict.health.training;
  const unit = profile.use().weightUnit ?? "kg";
  const shortDate = useShortDate();
  const name = useExerciseName();

  const details = (w: Workout) => {
    const parts = [shortDate(w.day), t.log.intensities[INTENSITY_KEYS[w.intensity]]];
    if (w.exercises?.length) parts.push(exercisesSummary(w.exercises, name, (n) => formatNumber(locale, n)));
    if (w.distanceKm) parts.push(`${formatNumber(locale, w.distanceKm, w.distanceKm % 1 ? 1 : 0)} km`);
    if (w.note) parts.push(w.note);
    return parts.join(" · ");
  };

  return (
    <Panel>
      <h2 className="mb-3 text-headline font-semibold">{t.history.title}</h2>
      {list.length === 0 ? (
        <p className="text-subhead text-muted">{t.history.empty}</p>
      ) : (
        <ul className="space-y-2">
          {sortRecent(list)
            .slice(0, HISTORY_LIMIT)
            .map((w) => {
              const kcal = workoutKcal(w, weight);
              const typeName = t.types[w.type];
              return (
                <li key={w.id} className="card flex items-center gap-3 py-2.5 pe-1.5 ps-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-subhead font-semibold">{typeName}</p>
                    <p className="line-clamp-2 text-footnote text-muted">{details(w)}</p>
                    {w.exercises?.length ? (
                      <p className="num truncate text-footnote text-muted">
                        {interpolate(t.session.summary, {
                          sets: formatNumber(locale, totalSets(w.exercises)),
                          volume: formatNumber(locale, Math.round(fromKg(volumeKg(w.exercises), unit))),
                          unit,
                        })}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-end">
                    <p className="num text-subhead">{interpolate(t.week.minutes, { n: formatNumber(locale, w.minutes) })}</p>
                    {kcal !== null && <p className="num text-footnote text-muted">{interpolate(t.week.kcal, { n: formatNumber(locale, kcal) })}</p>}
                  </div>
                  <DeleteButton
                    label={interpolate(t.history.delete, { name: typeName, date: shortDate(w.day) })}
                    onClick={() => workouts.set((prev) => prev.filter((x) => x.id !== w.id))}
                  />
                </li>
              );
            })}
        </ul>
      )}
    </Panel>
  );
}

/** Peso nell'unità dell'utente: "85", "92,5" (decimale solo se serve). */
function weightText(locale: Locale, kg: number, unit: WeightUnit): string {
  const v = fromKg(kg, unit);
  return formatNumber(locale, v, v % 1 ? 1 : 0);
}

/** "Panca piana, Squat +2": i primi due esercizi e quanti altri. */
function exercisesSummary(exercises: readonly ExerciseLog[], name: (log: ExerciseLog) => string, n: (v: number) => string): string {
  const shown = exercises.slice(0, 2).map(name).join(", ");
  return exercises.length > 2 ? `${shown} +${n(exercises.length - 2)}` : shown;
}
