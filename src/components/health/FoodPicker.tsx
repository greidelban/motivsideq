"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { formatNumber, interpolate } from "@/i18n/format";
import { type FoodNames, foodName, isValidAmount, nutrientsFor, searchFoods } from "@/lib/health/catalog/catalog";
import { foodConsensus, refreshConsensus } from "@/lib/health/catalog/community";
import { type ConsensusItem, canCorrect, withConsensus } from "@/lib/health/catalog/corrections";
import type { CatalogFood } from "@/lib/health/catalog/foods";
import { useFoodNames } from "@/lib/health/catalog/use-food-names";
import type { Meal } from "@/lib/health/food";
import { addFood } from "@/lib/health/store";
import { pulseLight } from "@/lib/light/bus";
import { profileAgeGroup } from "@/lib/profile/profile";
import { profile } from "@/lib/profile/store";
import { accountAvailable } from "@/lib/supabase/client";
import { Chip, Notice } from "./Chip";
import { FoodCorrection } from "./FoodCorrection";
import { parseDecimal } from "./shared";

// Ricerca nella tabella degli alimenti inclusa nell'app: si sceglie l'alimento,
// poi la quantità (porzione tipica o grammi) e i valori si calcolano da soli.
export function FoodPicker({ meal, day }: { meal: Meal; day: string }) {
  const { locale, dict } = useI18n();
  const t = dict.health.food.search;
  const names = useFoodNames(locale);
  // Le bevande alcoliche non compaiono a chi ha meno di 18 anni.
  const minor = profileAgeGroup(profile.use()) === "minor";
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<CatalogFood | null>(null);
  const consensus = foodConsensus.use();

  // Valori corretti dalla comunità: si riscaricano al massimo una volta al giorno (solo con un account).
  useEffect(() => {
    void refreshConsensus();
  }, []);

  if (picked && names) {
    return (
      <PickedFood
        food={picked}
        consensus={consensus.items}
        names={names}
        meal={meal}
        day={day}
        onDone={() => {
          setPicked(null);
          setQuery("");
        }}
        onCancel={() => setPicked(null)}
      />
    );
  }

  const results = names ? searchFoods(names, query, { alcohol: !minor }) : [];

  return (
    <div>
      <label htmlFor="food-search" className="label">
        {t.label}
      </label>
      <input
        id="food-search"
        type="search"
        className="field"
        autoComplete="off"
        placeholder={t.placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {names && query.trim() !== "" && results.length === 0 && (
        <p className="mt-2 text-footnote text-muted" role="status">
          {interpolate(t.noResults, { query: query.trim() })}
        </p>
      )}
      {names && results.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {results.map((food) => (
            <li key={food.id}>
              <button
                type="button"
                onClick={() => setPicked(food)}
                className="card block min-h-11 w-full px-4 py-2 text-start hover:bg-[var(--control-bg-hover)]"
              >
                {/* Nome intero: "crudo" e "cotto" non devono sparire tagliati. */}
                <span className="block text-subhead font-semibold">{foodName(names, food.id)}</span>
                <span className="num block text-footnote text-muted">
                  {interpolate(t.per100, { kcal: formatNumber(locale, food.kcal), unit: dict.health.food.units[food.unit] })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PickedFood({
  food: base,
  consensus,
  names,
  meal,
  day,
  onDone,
  onCancel,
}: {
  food: CatalogFood;
  consensus: readonly ConsensusItem[];
  names: FoodNames;
  meal: Meal;
  day: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.health.food;
  const s = t.search;
  const { food, votes } = withConsensus(base, consensus);
  const unit = t.units[food.unit];
  // Si parte dalla porzione tipica (es. un uovo), altrimenti da 100 g.
  const [amount, setAmount] = useState(String(food.portions?.[0]?.[1] ?? 100));
  const value = parseDecimal(amount);
  const values = isValidAmount(value) ? nutrientsFor(food, value) : null;
  const name = foodName(names, food.id) ?? food.id;
  const grams = (n: number) => formatNumber(locale, n, n % 1 ? 1 : 0);
  const options: [string, number][] = [
    ...(food.portions ?? []).map(([key, g]): [string, number] => [interpolate(s.portion, { portion: t.portions[key], n: grams(g), unit }), g]),
    [interpolate(s.hundred, { unit }), 100],
  ];

  function add() {
    if (!values) return;
    addFood({ meal, name: name.slice(0, 80), ...values, foodId: food.id, amount: value }, day);
    pulseLight(0.25);
    onDone();
  }

  return (
    <div className="space-y-4">
      <div className="card px-4 py-3">
        <p className="text-headline font-semibold">{name}</p>
        <p className="num mt-0.5 text-footnote text-muted">{interpolate(s.per100, { kcal: formatNumber(locale, food.kcal), unit })}</p>
        {votes !== null && <p className="mt-0.5 text-footnote text-secondary">{interpolate(t.community.corrected, { n: formatNumber(locale, votes) })}</p>}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={interpolate(s.amount, { unit })}>
        {options.map(([label, g]) => (
          <Chip key={label} active={value === g} onClick={() => setAmount(String(g))}>
            {label}
          </Chip>
        ))}
      </div>

      <div>
        <label htmlFor="food-amount" className="label">
          {interpolate(s.amount, { unit })}
        </label>
        <input
          id="food-amount"
          className="field num"
          inputMode="decimal"
          value={amount}
          aria-invalid={values ? undefined : true}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      {values ? (
        <div className="grid grid-cols-2 gap-2 text-center" aria-live="polite">
          {(
            [
              [t.summary.kcal, formatNumber(locale, values.kcal)],
              [t.summary.protein, interpolate(t.summary.grams, { n: grams(values.protein) })],
              [t.summary.carbs, interpolate(t.summary.grams, { n: grams(values.carbs) })],
              [t.summary.fat, interpolate(t.summary.grams, { n: grams(values.fat) })],
            ] as const
          ).map(([label, v]) => (
            <div key={label} className="card px-1 py-2">
              <p className="num truncate text-subhead font-semibold">{v}</p>
              <p className="truncate text-caption text-muted">{label}</p>
            </div>
          ))}
        </div>
      ) : (
        <Notice tone="error">{s.invalidAmount}</Notice>
      )}

      <button type="button" className="btn btn-primary w-full" disabled={!values} onClick={add}>
        {interpolate(s.addTo, { meal: t.meals[meal] })}
      </button>
      <p className="text-footnote text-muted">{s.source}</p>
      {accountAvailable() && canCorrect(food) && <FoodCorrection key={food.id} food={food} />}
      <button type="button" className="link min-h-11 text-footnote" onClick={onCancel}>
        {s.change}
      </button>
    </div>
  );
}
