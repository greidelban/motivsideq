"use client";

import { type FormEvent, useState } from "react";
import { Segmented } from "@/components/brain/Segmented";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { formatNumber, interpolate, plural } from "@/i18n/format";
import { localDateKey } from "@/lib/dates";
import { addWorkout, workouts } from "@/lib/health/store";
import {
  type Intensity,
  MAX_MINUTES,
  WORKOUT_CATEGORIES,
  type WorkoutType,
  sortRecent,
  typesIn,
  weekSummary,
  workoutKcal,
} from "@/lib/health/workouts";
import { pulseLight } from "@/lib/light/bus";
import { latestWeight } from "@/lib/profile/profile";
import { bodyWeights } from "@/lib/profile/store";
import { useHydrated } from "@/lib/storage/local-store";
import { Chip, Notice } from "./Chip";
import { DeleteButton, ProfileMissing, useShortDate } from "./shared";

const INTENSITY_KEYS = { 1: "light", 2: "moderate", 3: "hard" } as const;
const HISTORY_LIMIT = 30;

export function TrainingView() {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="min-h-96" />;
  return <Training />;
}

function Training() {
  const { locale, dict } = useI18n();
  const t = dict.health.training;
  const list = workouts.use();
  const weight = latestWeight(bodyWeights.use())?.kg ?? null;
  const today = localDateKey();
  const week = weekSummary(list, weight, today);
  const shortDate = useShortDate();

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
                const name = t.types[w.type];
                return (
                  <li key={w.id} className="card flex items-center gap-3 py-2.5 pr-1.5 pl-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-subhead font-semibold">{name}</p>
                      <p className="truncate text-footnote text-muted">
                        {shortDate(w.day)} · {t.log.intensities[INTENSITY_KEYS[w.intensity]]}
                        {w.note ? ` · ${w.note}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="num text-subhead">{interpolate(t.week.minutes, { n: formatNumber(locale, w.minutes) })}</p>
                      {kcal !== null && <p className="num text-footnote text-muted">{interpolate(t.week.kcal, { n: formatNumber(locale, kcal) })}</p>}
                    </div>
                    <DeleteButton
                      label={interpolate(t.history.delete, { name, date: shortDate(w.day) })}
                      onClick={() => workouts.set((prev) => prev.filter((x) => x.id !== w.id))}
                    />
                  </li>
                );
              })}
          </ul>
        )}
      </Panel>
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

function LogWorkout({ weight, today }: { weight: number | null; today: string }) {
  const { locale, dict } = useI18n();
  const t = dict.health.training;
  const [type, setType] = useState<WorkoutType>("gym");
  const [minutes, setMinutes] = useState("45");
  const [intensity, setIntensity] = useState<Intensity>(2);
  const [day, setDay] = useState(today);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"saved" | "invalid" | null>(null);

  const mins = Number(minutes);
  const validMinutes = Number.isInteger(mins) && mins >= 1 && mins <= MAX_MINUTES;
  const estimate = validMinutes ? workoutKcal({ type, minutes: mins, intensity }, weight) : null;

  function save(e: FormEvent) {
    e.preventDefault();
    if (!validMinutes || !day || day > today) {
      setStatus("invalid");
      return;
    }
    addWorkout({ type, minutes: mins, intensity, day, note: note.trim() || undefined });
    pulseLight(0.6);
    setNote("");
    setStatus("saved");
  }

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
                  <Chip
                    key={id}
                    active={type === id}
                    onClick={() => {
                      setType(id);
                      setStatus(null);
                    }}
                  >
                    {t.types[id]}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="workout-minutes" className="label">
              {t.log.duration}
            </label>
            <input
              id="workout-minutes"
              className="field num"
              inputMode="numeric"
              value={minutes}
              aria-invalid={status === "invalid" && !validMinutes ? true : undefined}
              onChange={(e) => {
                setMinutes(e.target.value.replace(/\D/g, "").slice(0, 3));
                setStatus(null);
              }}
            />
          </div>
          <div>
            <label htmlFor="workout-day" className="label">
              {dict.health.day}
            </label>
            <input id="workout-day" type="date" className="field" value={day} max={today} onChange={(e) => setDay(e.target.value)} />
          </div>
        </div>

        <Segmented
          label={t.log.intensity}
          value={intensity}
          onChange={setIntensity}
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
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="num text-subhead text-ink-2">{estimate !== null && interpolate(t.log.estimate, { n: formatNumber(locale, estimate) })}</p>
          <button type="submit" className="btn btn-primary">
            {t.log.save}
          </button>
        </div>
        {status === "saved" && <Notice tone="success">{t.log.saved}</Notice>}
        {status === "invalid" && <Notice tone="error">{interpolate(t.log.invalidMinutes, { max: MAX_MINUTES })}</Notice>}
      </form>
    </Panel>
  );
}
