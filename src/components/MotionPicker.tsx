"use client";

import { Panel } from "@/components/ui";
import { usePrefersReducedMotion } from "@/components/light/MotionSync";
import { useI18n } from "@/i18n/client";
import { appearance } from "@/lib/light/appearance";
import { motionLabel } from "@/lib/light/motion";

// Cursore del livello di animazione. Con "riduci movimento" attivo nel sistema
// il cursore si blocca: quella scelta vince sempre.
export function MotionPicker() {
  const { dict } = useI18n();
  const t = dict.settings.motion;
  const settings = appearance.use();
  const reduced = usePrefersReducedMotion();
  const level = reduced ? 0 : settings.motion;

  return (
    <Panel>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-headline font-semibold">{t.title}</h2>
        <span className="text-subhead font-semibold text-secondary" aria-hidden="true">
          {t.levels[motionLabel(level)]}
        </span>
      </div>
      <p className="mb-4 text-footnote text-muted">{t.hint}</p>
      <label htmlFor="motion" className="sr-only">
        {t.label}
      </label>
      <input
        id="motion"
        type="range"
        min={0}
        max={100}
        step={10}
        value={level}
        disabled={reduced}
        aria-valuetext={t.levels[motionLabel(level)]}
        aria-describedby={reduced ? "motion-reduced" : undefined}
        onChange={(e) => appearance.set((s) => ({ ...s, motion: Number(e.target.value) }))}
        className="motion-range w-full"
      />
      <div className="mt-1 flex justify-between text-caption text-muted" aria-hidden="true">
        <span>{t.levels.still}</span>
        <span>{t.levels.max}</span>
      </div>
      {reduced && (
        <p id="motion-reduced" className="mt-3 text-footnote text-ink-2">
          {t.reduced}
        </p>
      )}
    </Panel>
  );
}
