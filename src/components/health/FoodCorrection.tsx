"use client";

import Link from "next/link";
import { useState } from "react";
import { Segmented } from "@/components/brain/Segmented";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/format";
import { type SubmitResult, submitCorrection } from "@/lib/health/catalog/community";
import { KJ_PER_KCAL, checkCorrection, toKcal } from "@/lib/health/catalog/corrections";
import type { CatalogFood } from "@/lib/health/catalog/foods";
import { useSession } from "@/lib/supabase/client";
import { Notice } from "./Chip";
import { parseDecimal } from "./shared";

const FIELDS = ["protein", "carbs", "fat"] as const;
type EnergyUnit = "kcal" | "kJ";

// "Valori sbagliati? Correggili": solo con un account con email verificata.
// I valori si copiano dall'etichetta (energia in kcal o kJ, come è scritta);
// il server tiene un voto per persona e l'app usa la mediana di tutti.
export function FoodCorrection({ food }: { food: CatalogFood }) {
  const { dict } = useI18n();
  const t = dict.health.food.community;
  const session = useSession();
  const [open, setOpen] = useState(false);
  const verified = Boolean(session?.user.email_confirmed_at);

  if (!open) {
    return (
      <button type="button" aria-expanded={false} className="link min-h-11 text-footnote" onClick={() => setOpen(true)}>
        {t.wrong}
      </button>
    );
  }

  return (
    <section className="card space-y-4 px-4 py-4" aria-labelledby="food-correction-title">
      <h3 id="food-correction-title" className="text-headline font-semibold">
        {t.title}
      </h3>
      {verified ? (
        <CorrectionForm food={food} onClose={() => setOpen(false)} />
      ) : (
        <>
          <p className="text-subhead text-ink-2">{t.needAccount}</p>
          <div className="flex gap-3">
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setOpen(false)}>
              {dict.common.cancel}
            </button>
            <Link href="/account" className="btn btn-primary flex-1">
              {t.openAccount}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

function CorrectionForm({ food, onClose }: { food: CatalogFood; onClose: () => void }) {
  const { dict } = useI18n();
  const t = dict.health.food.community;
  const add = dict.health.food.add;
  const unit = dict.health.food.units[food.unit];
  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>("kcal");
  // Si parte dai valori attuali (senza separatori delle migliaia): spesso se ne cambia solo uno.
  const [energy, setEnergy] = useState(String(food.kcal));
  const [macros, setMacros] = useState<Record<(typeof FIELDS)[number], string>>({
    protein: String(food.protein),
    carbs: String(food.carbs),
    fat: String(food.fat),
  });
  const [state, setState] = useState<"idle" | "sending" | SubmitResult>("idle");

  const values = {
    kcal: toKcal(parseDecimal(energy), energyUnit),
    protein: parseDecimal(macros.protein),
    carbs: parseDecimal(macros.carbs),
    fat: parseDecimal(macros.fat),
  };
  const check = checkCorrection(values);

  function switchUnit(next: EnergyUnit) {
    if (next === energyUnit) return;
    // Il numero scritto si converte: chi copia dall'etichetta vede subito l'equivalente.
    const value = parseDecimal(energy);
    if (Number.isFinite(value)) {
      const converted = next === "kJ" ? value * KJ_PER_KCAL : value / KJ_PER_KCAL;
      setEnergy(String(Math.round(converted)));
    }
    setEnergyUnit(next);
  }

  async function send() {
    if (check !== "ok") return;
    setState("sending");
    setState(await submitCorrection(food.id, values));
  }

  if (state === "ok") {
    return (
      <>
        <Notice tone="success">{t.sent}</Notice>
        <button type="button" className="btn btn-ghost w-full" onClick={onClose}>
          {dict.common.back}
        </button>
      </>
    );
  }

  return (
    <>
      <p className="text-footnote text-muted">{interpolate(t.intro, { unit })}</p>
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <div>
          <label htmlFor="fix-energy" className="label">
            {t.energy}
          </label>
          <input id="fix-energy" className="field num" inputMode="decimal" value={energy} onChange={(e) => setEnergy(e.target.value)} />
        </div>
        <div className="w-32">
          <Segmented
            label={t.energy}
            labelHidden
            options={[
              { value: "kcal", label: "kcal" },
              { value: "kJ", label: "kJ" },
            ]}
            value={energyUnit}
            onChange={switchUnit}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {FIELDS.map((k) => (
          <div key={k}>
            <label htmlFor={`fix-${k}`} className="label truncate">
              {add[k]}
            </label>
            <input
              id={`fix-${k}`}
              className="field num"
              inputMode="decimal"
              value={macros[k]}
              onChange={(e) => setMacros((prev) => ({ ...prev, [k]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {check === "invalid" && <Notice tone="warning">{interpolate(t.invalid, { unit })}</Notice>}
      {check === "inconsistent" && <Notice tone="warning">{t.inconsistent}</Notice>}
      {state === "limit" && <Notice tone="error">{t.limit}</Notice>}
      {state === "error" && <Notice tone="error">{t.error}</Notice>}
      {state === "needAccount" && <Notice tone="error">{t.needAccount}</Notice>}
      <p className="text-footnote text-muted">{t.privacy}</p>
      <div className="flex gap-3">
        <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
          {dict.common.cancel}
        </button>
        <button type="button" className="btn btn-primary flex-1" disabled={check !== "ok" || state === "sending"} onClick={send}>
          {state === "sending" ? t.sending : t.send}
        </button>
      </div>
    </>
  );
}
