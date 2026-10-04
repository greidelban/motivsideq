"use client";

import { type FormEvent, useState } from "react";
import { Chip, ChipGroup, Notice } from "@/components/health/Chip";
import { parseDecimal } from "@/components/health/shared";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { formatNumber, interpolate } from "@/i18n/format";
import { MIN_AGE } from "@/lib/age";
import { localDateKey } from "@/lib/dates";
import { dailyTargets } from "@/lib/health/energy";
import {
  ACTIVITY_LEVELS,
  type ActivityLevel,
  GOALS,
  type Goal,
  HEIGHT_RANGE,
  type Profile,
  SEXES,
  type Sex,
  WEIGHT_RANGE,
  isBirthAllowed,
  latestWeight,
  profileAgeGroup,
  upsertWeight,
} from "@/lib/profile/profile";
import { bodyWeights, profile } from "@/lib/profile/store";
import { useHydrated } from "@/lib/storage/local-store";

const OLDEST = 100;

// Profilo (sesso, nascita, altezza, peso, attività, obiettivo): serve ad
// Allenamento e Cibo per le stime, e al Ciclo per l'età.
export function ProfilePanel() {
  const { dict } = useI18n();
  const hydrated = useHydrated();
  const saved = profile.use();
  const weights = bodyWeights.use();
  return (
    <Panel id="profile" className="scroll-mt-4">
      <h2 className="mb-1 text-headline font-semibold">{dict.settings.profile.title}</h2>
      <p className="mb-4 text-footnote text-muted">{dict.settings.profile.hint}</p>
      {/* Il modulo parte dai dati salvati, che si leggono solo nel browser. */}
      {hydrated ? <ProfileForm initial={saved} initialWeight={latestWeight(weights)?.kg ?? null} /> : <div className="min-h-96" />}
    </Panel>
  );
}

function ProfileForm({ initial, initialWeight }: { initial: Profile; initialWeight: number | null }) {
  const { locale, dict } = useI18n();
  const t = dict.settings.profile;
  const now = new Date();
  const [sex, setSex] = useState<Sex | undefined>(initial.sex);
  const [month, setMonth] = useState(initial.birthMonth?.toString() ?? "");
  const [year, setYear] = useState(initial.birthYear?.toString() ?? "");
  const [height, setHeight] = useState(initial.heightCm?.toString() ?? "");
  const [weight, setWeight] = useState(initialWeight === null ? "" : formatNumber(locale, initialWeight, initialWeight % 1 ? 1 : 0));
  const [activity, setActivity] = useState<ActivityLevel | "">(initial.activityLevel ?? "");
  const [goal, setGoal] = useState<Goal | undefined>(initial.goal);
  const [status, setStatus] = useState<"saved" | "invalid" | null>(null);

  const birthYear = year ? Number(year) : undefined;
  const birthMonth = month ? Number(month) : undefined;
  const birthComplete = birthYear !== undefined && birthMonth !== undefined;
  const birthOk = !birthComplete || isBirthAllowed(birthYear, birthMonth, now);
  const draft: Profile = { sex, birthYear: birthOk ? birthYear : undefined, birthMonth: birthOk ? birthMonth : undefined };
  const minor = birthOk && profileAgeGroup(draft, now) !== "adult" && birthComplete;

  const heightValue = parseDecimal(height);
  const weightValue = parseDecimal(weight);
  const heightOk = height.trim() === "" || (heightValue >= HEIGHT_RANGE.min && heightValue <= HEIGHT_RANGE.max);
  const weightOk = weight.trim() === "" || (weightValue >= WEIGHT_RANGE.min && weightValue <= WEIGHT_RANGE.max);

  const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2000, i, 1)));
  const lastYear = now.getFullYear() - MIN_AGE;
  const years = Array.from({ length: OLDEST - MIN_AGE + 1 }, (_, i) => lastYear - i);

  function change<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setStatus(null);
    };
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!birthOk || !heightOk || !weightOk) {
      setStatus("invalid");
      return;
    }
    const next: Profile = {
      sex,
      birthYear: birthComplete ? birthYear : undefined,
      birthMonth: birthComplete ? birthMonth : undefined,
      heightCm: height.trim() ? Math.round(heightValue * 10) / 10 : undefined,
      activityLevel: activity || undefined,
      // Sotto i 18 anni "dimagrire" non si salva.
      goal: minor && goal === "lose" ? "maintain" : goal,
    };
    profile.set(next);
    if (weight.trim()) {
      const kg = Math.round(weightValue * 10) / 10;
      if (kg !== initialWeight) bodyWeights.set((prev) => upsertWeight(prev, { day: localDateKey(), kg }));
    }
    setStatus("saved");
  }

  const savedProfile = profile.use();
  const savedWeight = latestWeight(bodyWeights.use())?.kg ?? null;
  const targets = dailyTargets(savedProfile, savedWeight, now);

  return (
    <form onSubmit={save} className="space-y-5">
      <ChipGroup label={t.sex}>
        {SEXES.map((s) => (
          <Chip key={s} active={sex === s} onClick={() => change(setSex)(sex === s ? undefined : s)}>
            {t.sexes[s]}
          </Chip>
        ))}
      </ChipGroup>
      <p className="-mt-3 text-footnote text-muted">{t.sexHint}</p>

      <fieldset>
        <legend className="label">{t.birth}</legend>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div>
            <label htmlFor="birth-month" className="sr-only">
              {t.month}
            </label>
            <select id="birth-month" className="field" value={month} onChange={(e) => change(setMonth)(e.target.value)} aria-invalid={!birthOk || undefined}>
              <option value="">{t.month}</option>
              {months.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="birth-year" className="sr-only">
              {t.year}
            </label>
            <select id="birth-year" className="field num" value={year} onChange={(e) => change(setYear)(e.target.value)} aria-invalid={!birthOk || undefined}>
              <option value="">{t.year}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className={`mt-1.5 text-footnote ${birthOk ? "text-muted" : "text-error"}`}>{birthOk ? t.birthHint : t.tooYoung}</p>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="height" className="label">
            {t.height}
          </label>
          <input
            id="height"
            className="field num"
            inputMode="decimal"
            placeholder="170"
            value={height}
            aria-invalid={!heightOk || undefined}
            onChange={(e) => change(setHeight)(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="weight" className="label">
            {t.weight}
          </label>
          <input
            id="weight"
            className="field num"
            inputMode="decimal"
            placeholder="65"
            value={weight}
            aria-invalid={!weightOk || undefined}
            aria-describedby="weight-hint"
            onChange={(e) => change(setWeight)(e.target.value)}
          />
        </div>
      </div>
      {!heightOk && <Notice tone="error">{t.invalidHeight}</Notice>}
      {!weightOk && <Notice tone="error">{t.invalidWeight}</Notice>}
      <p id="weight-hint" className="-mt-3 text-footnote text-muted">
        {t.weightHint}
      </p>

      <div>
        <label htmlFor="activity" className="label">
          {t.activity}
        </label>
        <select id="activity" className="field" value={activity} onChange={(e) => change(setActivity)(e.target.value as ActivityLevel | "")}>
          <option value="">{t.notSet}</option>
          {ACTIVITY_LEVELS.map((a) => (
            <option key={a} value={a}>
              {t.activities[a]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <ChipGroup label={t.goal}>
          {GOALS.filter((g) => !(minor && g === "lose")).map((g) => (
            <Chip key={g} active={goal === g} onClick={() => change(setGoal)(goal === g ? undefined : g)}>
              {t.goals[g]}
            </Chip>
          ))}
        </ChipGroup>
        {minor && <p className="mt-1.5 text-footnote text-muted">{t.goalMinor}</p>}
      </div>

      <button type="submit" className="btn btn-primary w-full">
        {t.save}
      </button>
      {status === "saved" && (
        <Notice tone="success">
          {t.saved}
          {targets.kcal !== null && targets.protein !== null && (
            <span className="mt-1 block text-ink-2">
              {interpolate(t.estimate, { kcal: formatNumber(locale, targets.kcal), protein: formatNumber(locale, targets.protein) })}
            </span>
          )}
        </Notice>
      )}
    </form>
  );
}
