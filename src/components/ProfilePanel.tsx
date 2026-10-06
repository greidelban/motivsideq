"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Chip, ChipGroup, Notice } from "@/components/health/Chip";
import { parseDecimal } from "@/components/health/shared";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { formatNumber, interpolate } from "@/i18n/format";
import { MIN_AGE } from "@/lib/age";
import { localDateKey } from "@/lib/dates";
import { hasCycleData } from "@/lib/health/cycle-access";
import { assessBody } from "@/lib/health/body";
import { dailyTargets } from "@/lib/health/energy";
import { cycleConsent, cycleDayLogs, cyclePeriods, deleteCycleData, workouts } from "@/lib/health/store";
import {
  ACTIVITY_LEVELS,
  type ActivityLevel,
  GOALS,
  type Goal,
  HEIGHT_RANGE,
  NAME_MAX,
  type Profile,
  SEXES,
  type Sex,
  WAIST_RANGE,
  WEIGHT_RANGE,
  cleanName,
  isBirthAllowed,
  latestWeight,
  profileAgeGroup,
  upsertWeight,
} from "@/lib/profile/profile";
import { bodyWeights, profile } from "@/lib/profile/store";
import { deviceUnits } from "@/lib/profile/use-units";
import { useLocalData } from "@/lib/storage/db";
import {
  HEIGHT_UNITS,
  type HeightUnit,
  WEIGHT_UNITS,
  type WeightUnit,
  cmToFeetInches,
  cmToInches,
  feetInchesToCm,
  fromKg,
  inchesToCm,
  toKg,
} from "@/lib/units";

const OLDEST = 100;
/** Attesa dopo l'ultima modifica prima di salvare (mentre si scrive non si salva a ogni tasto). */
const AUTOSAVE_DELAY = 600;

// Profilo (nome, sesso, nascita, altezza, peso, attività, obiettivo): serve ad
// Allenamento e Cibo per le stime, al Ciclo per sesso ed età, a Oggi per il saluto.
export function ProfilePanel() {
  const { dict } = useI18n();
  const hydrated = useLocalData();
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

// Salvataggio automatico: ogni modifica valida si salva da sola poco dopo
// (e comunque quando si lascia la pagina). Un valore non valido mentre si
// scrive non cancella quello salvato.
function ProfileForm({ initial, initialWeight }: { initial: Profile; initialWeight: number | null }) {
  const { locale, dict } = useI18n();
  const t = dict.settings.profile;
  const now = new Date();
  const showWeight = (kg: number, u: WeightUnit) => {
    const v = fromKg(kg, u);
    return formatNumber(locale, v, v % 1 ? 1 : 0);
  };

  const [name, setName] = useState(initial.displayName ?? "");
  const [sex, setSex] = useState<Sex | undefined>(initial.sex);
  const [month, setMonth] = useState(initial.birthMonth?.toString() ?? "");
  const [year, setYear] = useState(initial.birthYear?.toString() ?? "");
  // Finché l'utente non sceglie, le unità del suo paese (libbre e piedi negli Stati Uniti).
  const [fallback] = useState(deviceUnits);
  const [height, setHeight] = useState(initial.heightCm?.toString() ?? "");
  const [heightUnit, setHeightUnit] = useState<HeightUnit>(initial.heightUnit ?? fallback.height);
  const initialFtIn = initial.heightCm === undefined ? null : cmToFeetInches(initial.heightCm);
  const [feet, setFeet] = useState(initialFtIn ? String(initialFtIn.feet) : "");
  const [inches, setInches] = useState(initialFtIn ? String(initialFtIn.inches) : "");
  const [unit, setUnit] = useState<WeightUnit>(initial.weightUnit ?? fallback.weight);
  const [weight, setWeight] = useState(initialWeight === null ? "" : showWeight(initialWeight, initial.weightUnit ?? fallback.weight));
  // Giro vita: in pollici con piedi e pollici, altrimenti in cm.
  const showWaist = (cm: number, u: HeightUnit) => formatNumber(locale, u === "ft" ? cmToInches(cm) : cm, 1).replace(/[.,]0$/, "");
  const [waist, setWaist] = useState(initial.waistCm === undefined ? "" : showWaist(initial.waistCm, initial.heightUnit ?? fallback.height));
  const [activity, setActivity] = useState<ActivityLevel | "">(initial.activityLevel ?? "");
  const [goal, setGoal] = useState<Goal | undefined>(initial.goal);
  const [savedOnce, setSavedOnce] = useState(false);
  // Sesso scelto in attesa della risposta sui dati del ciclo (se non è più "femmina").
  const [askSex, setAskSex] = useState<{ value: Sex | undefined } | null>(null);
  const periods = cyclePeriods.use();
  const logs = cycleDayLogs.use();
  const consent = cycleConsent.use();

  const birthYear = year ? Number(year) : undefined;
  const birthMonth = month ? Number(month) : undefined;
  const birthComplete = birthYear !== undefined && birthMonth !== undefined;
  const birthOk = !birthComplete || isBirthAllowed(birthYear, birthMonth, now);
  const draft: Profile = { sex, birthYear: birthOk ? birthYear : undefined, birthMonth: birthOk ? birthMonth : undefined };
  const minor = birthOk && profileAgeGroup(draft, now) !== "adult" && birthComplete;

  // Altezza in cm, oppure in piedi e pollici (si salva sempre in cm).
  const heightEmpty = heightUnit === "cm" ? height.trim() === "" : feet.trim() === "" && inches.trim() === "";
  const ftValue = parseDecimal(feet);
  const inValue = inches.trim() === "" ? 0 : parseDecimal(inches);
  const heightValue =
    heightUnit === "cm"
      ? parseDecimal(height)
      : Number.isInteger(ftValue) && inValue >= 0 && inValue < 12
        ? feetInchesToCm(ftValue, inValue)
        : NaN;
  const weightValue = parseDecimal(weight);
  const heightOk = heightEmpty || (heightValue >= HEIGHT_RANGE.min && heightValue <= HEIGHT_RANGE.max);
  const weightKg = Number.isFinite(weightValue) ? toKg(weightValue, unit) : NaN;
  const weightOk = weight.trim() === "" || (weightKg >= WEIGHT_RANGE.min && weightKg <= WEIGHT_RANGE.max);
  const waistValue = parseDecimal(waist);
  const waistCm = Number.isFinite(waistValue) ? (heightUnit === "ft" ? inchesToCm(waistValue) : Math.round(waistValue * 10) / 10) : NaN;
  const waistOk = waist.trim() === "" || (waistCm >= WAIST_RANGE.min && waistCm <= WAIST_RANGE.max);

  const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2000, i, 1)));
  const lastYear = now.getFullYear() - MIN_AGE;
  const years = Array.from({ length: OLDEST - MIN_AGE + 1 }, (_, i) => lastYear - i);

  /** Scrive negli store quello che c'è nel modulo; i campi non validi tengono il valore già salvato. */
  function saveNow() {
    const saved = profile.get();
    const birthEmpty = month === "" && year === "";
    const birthValid = birthComplete && birthOk;
    profile.set({
      // Prima i campi che questo modulo non tocca (es. gli obiettivi scelti in Cibo).
      ...saved,
      displayName: cleanName(name),
      sex,
      birthYear: birthEmpty ? undefined : birthValid ? birthYear : saved.birthYear,
      birthMonth: birthEmpty ? undefined : birthValid ? birthMonth : saved.birthMonth,
      heightCm: heightEmpty ? undefined : heightOk ? keepHeight(saved.heightCm, heightValue) : saved.heightCm,
      heightUnit,
      activityLevel: activity || undefined,
      // Sotto i 18 anni "dimagrire" non si salva.
      goal: minor && goal === "lose" ? "maintain" : goal,
      weightUnit: unit,
      waistCm: waist.trim() === "" ? undefined : waistOk ? waistCm : saved.waistCm,
    });
    // Peso: una nuova misura solo se è valido e diverso dall'ultimo salvato (anche dopo il cambio di unità).
    const last = latestWeight(bodyWeights.get())?.kg ?? null;
    if (weight.trim() && weightOk && (last === null || showWeight(last, unit) !== weight.trim())) {
      bodyWeights.set((prev) => upsertWeight(prev, { day: localDateKey(), kg: weightKg }));
    }
    setSavedOnce(true);
  }

  // saveNow vede sempre i valori dell'ultimo render (serve al timer e all'uscita dalla pagina).
  const saveRef = useRef(saveNow);
  useLayoutEffect(() => {
    saveRef.current = saveNow;
  });
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => {
      dirty.current = false;
      saveRef.current();
    }, AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [name, sex, month, year, height, feet, inches, heightUnit, weight, unit, waist, activity, goal]);

  // Uscendo dalla pagina, chiudendo l'app o passando a un'altra app prima che
  // scatti il timer, si salva subito.
  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return;
      dirty.current = false;
      saveRef.current();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  function change<T>(set: (v: T) => void) {
    return (v: T) => {
      dirty.current = true;
      set(v);
    };
  }

  function chooseSex(next: Sex | undefined) {
    // Da "femmina" ad altro con dati del ciclo presenti: prima si chiede cosa farne (mai cancellati da soli).
    if (profile.get().sex === "female" && next !== "female" && hasCycleData(periods, logs, consent)) {
      setAskSex({ value: next });
      return;
    }
    change(setSex)(next);
  }

  /**
   * In piedi e pollici i valori sono arrotondati al pollice: se corrispondono
   * ancora all'altezza salvata, si tiene quella (178 cm non diventa 177,8).
   */
  function keepHeight(saved: number | undefined, value: number): number {
    if (heightUnit === "ft" && saved !== undefined) {
      const a = cmToFeetInches(saved);
      const b = cmToFeetInches(value);
      if (a.feet === b.feet && a.inches === b.inches) return saved;
    }
    return Math.round(value * 10) / 10;
  }

  function switchHeightUnit(next: HeightUnit) {
    if (next === heightUnit) return;
    // Il valore scritto si converte, così non si perde.
    if (!heightEmpty && Number.isFinite(heightValue)) {
      if (next === "ft") {
        const v = cmToFeetInches(heightValue);
        setFeet(String(v.feet));
        setInches(String(v.inches));
      } else {
        setHeight(String(keepHeight(profile.get().heightCm, heightValue)));
      }
    }
    // Anche il giro vita passa da cm a pollici (o al contrario).
    if (waist.trim() && Number.isFinite(waistCm)) setWaist(showWaist(waistCm, next));
    change(setHeightUnit)(next);
  }

  function switchUnit(next: WeightUnit) {
    if (next === unit) return;
    // Il valore scritto si converte, così non si perde.
    if (weight.trim() && Number.isFinite(weightKg)) setWeight(showWeight(weightKg, next));
    change(setUnit)(next);
  }

  const targets = dailyTargets(profile.use(), latestWeight(bodyWeights.use())?.kg ?? null, now);
  const waistUnit = heightUnit === "ft" ? "in" : "cm";

  return (
    <form
      onSubmit={(e) => {
        // Invio sulla tastiera: si salva subito.
        e.preventDefault();
        dirty.current = false;
        saveNow();
      }}
      className="space-y-5"
    >
      <div>
        <label htmlFor="display-name" className="label">
          {t.name}
        </label>
        <input
          id="display-name"
          className="field"
          maxLength={NAME_MAX}
          autoComplete="given-name"
          placeholder={t.namePlaceholder}
          value={name}
          aria-describedby="display-name-hint"
          onChange={(e) => change(setName)(e.target.value)}
        />
        <p id="display-name-hint" className="mt-1.5 text-footnote text-muted">
          {interpolate(t.nameHint, { max: NAME_MAX })}
        </p>
      </div>

      <ChipGroup label={t.sex}>
        {SEXES.map((s) => (
          <Chip key={s} active={sex === s} onClick={() => chooseSex(sex === s ? undefined : s)}>
            {t.sexes[s]}
          </Chip>
        ))}
      </ChipGroup>
      <p className="-mt-3 text-footnote text-muted">{t.sexHint}</p>
      {askSex && (
        <div className="card p-4" role="alertdialog" aria-labelledby="cycle-data-question">
          <p id="cycle-data-question" className="text-subhead">
            {t.cycleData.question}
          </p>
          <p className="mt-2 text-footnote text-muted">{t.cycleData.keepNote}</p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              className="btn btn-ghost flex-1"
              onClick={() => {
                // Conservati ma in pausa (come cycle_tracking_enabled = false nel database).
                cycleConsent.set((c) => (c ? { ...c, enabled: false } : c));
                change(setSex)(askSex.value);
                setAskSex(null);
              }}
            >
              {t.cycleData.keep}
            </button>
            <button
              type="button"
              className="btn btn-danger flex-1"
              onClick={() => {
                deleteCycleData();
                change(setSex)(askSex.value);
                setAskSex(null);
              }}
            >
              {t.cycleData.delete}
            </button>
          </div>
          <button type="button" className="btn btn-ghost mt-2 w-full" onClick={() => setAskSex(null)}>
            {dict.common.cancel}
          </button>
        </div>
      )}

      <fieldset>
        <legend className="label">{t.birth}</legend>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div>
            <label htmlFor="birth-month" className="sr-only">
              {t.month}
            </label>
            <select id="birth-month" className="field" value={month} onChange={(e) => change(setMonth)(e.target.value)} aria-invalid={!birthOk || undefined}>
              <option value="">{t.month}</option>
              {months.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
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
        {heightUnit === "cm" ? (
          <div>
            <label htmlFor="height" className="label">
              {interpolate(t.height, { unit: t.heightUnits.cm })}
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
        ) : (
          <fieldset>
            <legend className="label">{interpolate(t.height, { unit: t.heightUnits.ft })}</legend>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="height-ft" className="sr-only">
                  {t.feet}
                </label>
                <input
                  id="height-ft"
                  className="field num"
                  inputMode="numeric"
                  placeholder="5"
                  value={feet}
                  aria-invalid={!heightOk || undefined}
                  onChange={(e) => change(setFeet)(e.target.value.replace(/\D/g, "").slice(0, 1))}
                />
              </div>
              <div>
                <label htmlFor="height-in" className="sr-only">
                  {t.inches}
                </label>
                <input
                  id="height-in"
                  className="field num"
                  inputMode="numeric"
                  placeholder="7"
                  value={inches}
                  aria-invalid={!heightOk || undefined}
                  onChange={(e) => change(setInches)(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
              </div>
            </div>
          </fieldset>
        )}
        <div>
          <label htmlFor="weight" className="label">
            {interpolate(t.weight, { unit })}
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
      {!heightOk && <Notice tone="error">{heightUnit === "cm" ? t.invalidHeight : t.invalidHeightFt}</Notice>}
      {!weightOk && (
        <Notice tone="error">
          {interpolate(t.invalidWeight, {
            min: formatNumber(locale, Math.ceil(fromKg(WEIGHT_RANGE.min, unit))),
            max: formatNumber(locale, Math.floor(fromKg(WEIGHT_RANGE.max, unit))),
            unit,
          })}
        </Notice>
      )}
      <p id="weight-hint" className="-mt-3 text-footnote text-muted">
        {t.weightHint}
      </p>

      <div>
        <label htmlFor="waist" className="label">
          {interpolate(t.waist, { unit: waistUnit })}
        </label>
        <input
          id="waist"
          className="field num max-w-40"
          inputMode="decimal"
          placeholder={heightUnit === "ft" ? "32" : "80"}
          value={waist}
          aria-invalid={!waistOk || undefined}
          aria-describedby="waist-hint"
          onChange={(e) => change(setWaist)(e.target.value)}
        />
        <p id="waist-hint" className="mt-1.5 text-footnote text-muted">
          {t.waistHint}
        </p>
        {!waistOk && (
          <Notice tone="error">
            {interpolate(t.invalidWaist, {
              min: formatNumber(locale, heightUnit === "ft" ? Math.ceil(cmToInches(WAIST_RANGE.min)) : WAIST_RANGE.min),
              max: formatNumber(locale, heightUnit === "ft" ? Math.floor(cmToInches(WAIST_RANGE.max)) : WAIST_RANGE.max),
              unit: waistUnit,
            })}
          </Notice>
        )}
      </div>

      <BodyCard weightUnit={unit} />

      <ChipGroup label={t.heightUnit}>
        {HEIGHT_UNITS.map((u) => (
          <Chip key={u} active={heightUnit === u} onClick={() => switchHeightUnit(u)}>
            {t.heightUnits[u]}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup label={t.weightUnit}>
        {WEIGHT_UNITS.map((u) => (
          <Chip key={u} active={unit === u} onClick={() => switchUnit(u)}>
            {u}
          </Chip>
        ))}
      </ChipGroup>

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

      <div className="card px-4 py-3" role="status" aria-live="polite">
        <p className="text-footnote text-muted">
          {savedOnce ? (
            <>
              <span className="text-success" aria-hidden="true">
                ✓{" "}
              </span>
              {t.saved}
            </>
          ) : (
            t.autosave
          )}
        </p>
        {targets.kcal !== null && targets.protein !== null && (
          <p className="mt-1 text-subhead text-ink-2">
            {interpolate(t.estimate, { kcal: formatNumber(locale, targets.kcal), protein: formatNumber(locale, targets.protein) })}
          </p>
        )}
      </div>
    </form>
  );
}

// Peso rispetto all'altezza (dai dati salvati): IMC, intervallo consigliato e
// le correzioni per chi ha molto muscolo. Sotto i 18 anni nessun giudizio.
function BodyCard({ weightUnit }: { weightUnit: WeightUnit }) {
  const { locale, dict } = useI18n();
  const t = dict.settings.profile.body;
  const saved = profile.use();
  const weight = latestWeight(bodyWeights.use())?.kg ?? null;
  const result = assessBody(saved, weight, workouts.use(), localDateKey());
  const w = (kg: number) => formatNumber(locale, Math.round(fromKg(kg, weightUnit)));

  return (
    <div className="card space-y-1.5 px-4 py-3" aria-live="polite">
      <p className="text-subhead font-semibold">{t.title}</p>
      {result.kind === "missing" && <p className="text-footnote text-muted">{t.missing}</p>}
      {result.kind === "minor" && <p className="text-footnote text-ink-2">{t.minor}</p>}
      {result.kind === "adult" && (
        <>
          <p className="text-subhead text-ink-2">
            <span className="num font-semibold text-ink">{interpolate(t.bmi, { n: formatNumber(locale, result.bmi, 1) })}</span> · {t.categories[result.category]}
          </p>
          <p className="text-footnote text-muted">
            {interpolate(t.range, { min: w(result.range.min), max: w(result.range.max), unit: weightUnit })}
          </p>
          {result.category === "under" && <p className="text-footnote text-ink-2">{t.under}</p>}
          {result.muscular && <p className="text-footnote text-ink-2">{t.muscular}</p>}
          {result.waist === "ok" && result.category !== "normal" && result.category !== "under" && <p className="text-footnote text-ink-2">{t.waistOk}</p>}
          {result.waist === "high" && <p className="text-footnote text-ink-2">{t.waistHigh}</p>}
          {result.waist === null && (result.category === "over" || result.category === "obese") && <p className="text-footnote text-muted">{t.waistAdd}</p>}
          <p className="text-caption text-muted">{t.note}</p>
        </>
      )}
    </div>
  );
}
