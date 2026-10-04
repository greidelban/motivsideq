"use client";

import { type FormEvent, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { formatNumber, interpolate } from "@/i18n/format";
import { addDays, localDateKey } from "@/lib/dates";
import { dailyTargets } from "@/lib/health/energy";
import { type FoodEntry, MAX_KCAL, MAX_MACRO_G, MEALS, type Meal, entriesOn, kcalConsistent, macroKcal, mealForHour, recentFoods, totals } from "@/lib/health/food";
import { addFood, foodEntries } from "@/lib/health/store";
import { pulseLight } from "@/lib/light/bus";
import { latestWeight } from "@/lib/profile/profile";
import { bodyWeights, profile } from "@/lib/profile/store";
import { useLocalData } from "@/lib/storage/db";
import { Chip, ChipGroup, Notice } from "./Chip";
import { DeleteButton, ProfileMissing, parseDecimal } from "./shared";

export function FoodView() {
  const hydrated = useLocalData();
  if (!hydrated) return <div className="min-h-96" />;
  return <Food />;
}

function Food() {
  const { locale, dict } = useI18n();
  const t = dict.health.food;
  const all = foodEntries.use();
  const today = localDateKey();
  const [day, setDay] = useState(today);
  const entries = entriesOn(all, day);
  const sum = totals(entries);
  const targets = dailyTargets(profile.use(), latestWeight(bodyWeights.use())?.kg ?? null);
  const [y, m, d] = day.split("-").map(Number);
  const dayLabel =
    day === today ? t.today : new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(y, m - 1, d));

  return (
    <>
      <div className="glass flex items-center gap-2 rounded-full p-1">
        <button type="button" aria-label={t.prevDay} onClick={() => setDay(addDays(day, -1))} className="grid size-11 place-items-center rounded-full text-ink-2 hover:text-ink">
          <IconChevronLeft width={20} height={20} />
        </button>
        <p className="flex-1 text-center text-subhead font-semibold first-letter:uppercase" aria-live="polite">
          {dayLabel}
        </p>
        <button
          type="button"
          aria-label={t.nextDay}
          disabled={day >= today}
          onClick={() => setDay(addDays(day, 1))}
          className="grid size-11 place-items-center rounded-full text-ink-2 hover:text-ink disabled:opacity-30"
        >
          <IconChevronRight width={20} height={20} />
        </button>
      </div>

      <Summary sum={sum} kcalGoal={targets.kcal} proteinGoal={targets.protein} />
      {(targets.minor || targets.missing.length > 0) && (
        <Panel className="py-4">
          {targets.minor ? <p className="text-footnote text-ink-2">{t.summary.minor}</p> : <ProfileMissing missing={targets.missing} />}
        </Panel>
      )}

      <AddFood day={day} recent={recentFoods(all)} />

      {entries.length === 0 ? (
        <Panel>
          <p className="text-subhead text-muted">{t.list.empty}</p>
        </Panel>
      ) : (
        MEALS.filter((meal) => entries.some((e) => e.meal === meal)).map((meal) => {
          const items = entries.filter((e) => e.meal === meal);
          return (
            <Panel key={meal}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-headline font-semibold">{t.meals[meal]}</h2>
                <p className="num text-subhead text-muted">
                  {formatNumber(locale, totals(items).kcal)} {t.summary.kcal}
                </p>
              </div>
              <ul className="space-y-2">
                {items.map((e) => (
                  <li key={e.id} className="card flex items-center gap-3 py-2.5 pr-1.5 pl-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-subhead font-semibold">{e.name}</p>
                      <Macros entry={e} />
                    </div>
                    <p className="num text-subhead">{formatNumber(locale, e.kcal)}</p>
                    <DeleteButton
                      label={interpolate(t.list.delete, { name: e.name })}
                      onClick={() => foodEntries.set((prev) => prev.filter((x) => x.id !== e.id))}
                    />
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })
      )}
    </>
  );
}

function Macros({ entry }: { entry: FoodEntry }) {
  const { locale, dict } = useI18n();
  const t = dict.health.food.summary;
  const parts = (
    [
      [t.protein, entry.protein],
      [t.carbs, entry.carbs],
      [t.fat, entry.fat],
    ] as const
  ).filter(([, g]) => g !== undefined);
  if (parts.length === 0) return null;
  return (
    <p className="truncate text-footnote text-muted">
      {parts.map(([label, g]) => `${label} ${interpolate(t.grams, { n: formatNumber(locale, g!, g! % 1 ? 1 : 0) })}`).join(" · ")}
    </p>
  );
}

function Summary({ sum, kcalGoal, proteinGoal }: { sum: ReturnType<typeof totals>; kcalGoal: number | null; proteinGoal: number | null }) {
  const { locale, dict } = useI18n();
  const t = dict.health.food.summary;
  const n = (v: number) => formatNumber(locale, Math.round(v));
  const progress = kcalGoal ? Math.min(sum.kcal / kcalGoal, 1) : 0;
  const diff = kcalGoal === null ? null : kcalGoal - sum.kcal;

  return (
    <Panel>
      <div className="flex items-baseline gap-2">
        <p className="num text-large font-bold">{n(sum.kcal)}</p>
        <p className="text-subhead text-muted">{kcalGoal ? interpolate(t.kcalOf, { goal: n(kcalGoal) }) : t.kcal}</p>
      </div>
      {kcalGoal !== null && (
        <>
          <div
            className="card mt-3 h-2.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={kcalGoal}
            aria-valuenow={Math.round(sum.kcal)}
          >
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="mt-2 text-footnote text-ink-2">
            {diff! >= 0 ? interpolate(t.left, { n: n(diff!) }) : interpolate(t.over, { n: n(-diff!) })}
          </p>
        </>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <MacroStat label={t.protein} value={proteinGoal ? interpolate(t.gramsOf, { n: n(sum.protein), goal: n(proteinGoal) }) : interpolate(t.grams, { n: n(sum.protein) })} />
        <MacroStat label={t.carbs} value={interpolate(t.grams, { n: n(sum.carbs) })} />
        <MacroStat label={t.fat} value={interpolate(t.grams, { n: n(sum.fat) })} />
      </div>
    </Panel>
  );
}

function MacroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-2 py-2.5">
      <p className="num truncate text-subhead font-semibold">{value}</p>
      <p className="truncate text-caption text-muted">{label}</p>
    </div>
  );
}

const MACRO_FIELDS = ["protein", "carbs", "fat"] as const;

function AddFood({ day, recent }: { day: string; recent: FoodEntry[] }) {
  const { locale, dict } = useI18n();
  const t = dict.health.food;
  const [meal, setMeal] = useState<Meal>(() => mealForHour(new Date().getHours()));
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [macros, setMacros] = useState<Record<(typeof MACRO_FIELDS)[number], string>>({ protein: "", carbs: "", fat: "" });
  const [error, setError] = useState(false);

  const kcalValue = parseDecimal(kcal);
  const macroValues = Object.fromEntries(
    MACRO_FIELDS.map((k) => {
      const v = parseDecimal(macros[k]);
      return [k, Number.isFinite(v) && v >= 0 && v <= MAX_MACRO_G ? v : undefined];
    }),
  ) as Record<(typeof MACRO_FIELDS)[number], number | undefined>;
  const validKcal = Number.isFinite(kcalValue) && kcalValue >= 0 && kcalValue <= MAX_KCAL;
  const mismatch = validKcal && !kcalConsistent(kcalValue, macroValues.protein, macroValues.carbs, macroValues.fat);

  function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !validKcal) {
      setError(true);
      return;
    }
    addFood({ meal, name: name.trim().slice(0, 80), kcal: Math.round(kcalValue), ...macroValues }, day);
    pulseLight(0.25);
    setName("");
    setKcal("");
    setMacros({ protein: "", carbs: "", fat: "" });
    setError(false);
  }

  return (
    <Panel>
      <h2 className="mb-4 text-headline font-semibold">{t.add.title}</h2>
      <form onSubmit={save} className="space-y-4">
        <ChipGroup label={t.add.meal}>
          {MEALS.map((m) => (
            <Chip key={m} active={meal === m} onClick={() => setMeal(m)}>
              {t.meals[m]}
            </Chip>
          ))}
        </ChipGroup>

        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <div>
            <label htmlFor="food-name" className="label">
              {t.add.name}
            </label>
            <input
              id="food-name"
              className="field"
              maxLength={80}
              placeholder={t.add.namePlaceholder}
              value={name}
              aria-invalid={error && !name.trim() ? true : undefined}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="food-kcal" className="label">
              {t.add.kcal}
            </label>
            <input
              id="food-kcal"
              className="field num"
              inputMode="decimal"
              value={kcal}
              aria-invalid={error && !validKcal ? true : undefined}
              onChange={(e) => setKcal(e.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="grid grid-cols-3 gap-3">
            {MACRO_FIELDS.map((k) => (
              <div key={k}>
                <label htmlFor={`food-${k}`} className="label truncate">
                  {t.add[k]}
                </label>
                <input
                  id={`food-${k}`}
                  className="field num"
                  inputMode="decimal"
                  value={macros[k]}
                  onChange={(e) => setMacros((prev) => ({ ...prev, [k]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-footnote text-muted">{t.add.macrosHint}</p>
        </div>

        {mismatch && (
          <Notice tone="warning">
            {interpolate(t.add.mismatch, {
              n: formatNumber(locale, Math.round(macroKcal(macroValues.protein, macroValues.carbs, macroValues.fat))),
            })}
          </Notice>
        )}
        {error && <Notice tone="error">{t.add.invalid}</Notice>}

        <button type="submit" className="btn btn-primary w-full">
          {t.add.save}
        </button>
      </form>

      {recent.length > 0 && (
        <div className="mt-5">
          <p className="eyebrow mb-2">{t.recent.title}</p>
          <div className="flex flex-wrap gap-2">
            {recent.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-label={interpolate(t.recent.add, { name: f.name })}
                onClick={() => {
                  addFood({ meal, name: f.name, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat }, day);
                  pulseLight(0.25);
                }}
                className="card min-h-11 max-w-full truncate rounded-full px-3.5 text-subhead text-ink-2 hover:text-ink"
              >
                + {f.name} <span className="num text-muted">{formatNumber(locale, f.kcal)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
