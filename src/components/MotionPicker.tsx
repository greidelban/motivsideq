"use client";

import { usePrefersReducedMotion } from "@/components/light/MotionSync";
import { useI18n } from "@/i18n/client";
import { appearance } from "@/lib/light/appearance";
import { motionLabel } from "@/lib/light/motion";

// Cursore del livello di animazione (solo nella pagina Sfondo: vale per lo sfondo
// e per le animazioni dell'interfaccia). Con "riduci movimento" attivo nel
// sistema il cursore si blocca: quella scelta vince sempre.
export function MotionSlider({ id = "motion" }: { id?: string }) {
  const { dict } = useI18n();
  const t = dict.settings.motion;
  const settings = appearance.use();
  const reduced = usePrefersReducedMotion();
  const level = reduced ? 0 : settings.motion;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="eyebrow">{t.title}</h2>
        <span className="text-footnote font-semibold text-secondary" aria-hidden="true">
          {t.levels[motionLabel(level)]}
        </span>
      </div>
      <p className="mb-2 text-footnote text-muted">{t.hint}</p>
      <label htmlFor={id} className="sr-only">
        {t.label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={10}
        value={level}
        disabled={reduced}
        aria-valuetext={t.levels[motionLabel(level)]}
        aria-describedby={reduced ? `${id}-reduced` : undefined}
        onChange={(e) => appearance.set((s) => ({ ...s, motion: Number(e.target.value) }))}
        className="motion-range w-full"
      />
      <div className="mt-1 flex justify-between text-caption text-muted" aria-hidden="true">
        <span>{t.levels.still}</span>
        <span>{t.levels.max}</span>
      </div>
      {reduced && (
        <p id={`${id}-reduced`} className="mt-3 text-footnote text-ink-2">
          {t.reduced}
        </p>
      )}
    </div>
  );
}
