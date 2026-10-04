"use client";

import { Panel } from "@/components/ui";
import { usePrefersReducedMotion } from "@/components/light/MotionSync";
import { useI18n } from "@/i18n/client";
import { appearance } from "@/lib/light/appearance";
import { motionLabel } from "@/lib/light/motion";

// Cursore del livello di animazione (Impostazioni e pagina Wallpaper). Con
// "riduci movimento" attivo nel sistema il cursore si blocca: quella scelta vince sempre.
export function MotionSlider({ id = "motion", compact = false }: { id?: string; compact?: boolean }) {
  const { dict } = useI18n();
  const t = dict.settings.motion;
  const settings = appearance.use();
  const reduced = usePrefersReducedMotion();
  const level = reduced ? 0 : settings.motion;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        {compact ? (
          <h2 className="eyebrow">{t.title}</h2>
        ) : (
          <h2 className="text-headline font-semibold">{t.title}</h2>
        )}
        <span className={`${compact ? "text-footnote" : "text-subhead"} font-semibold text-secondary`} aria-hidden="true">
          {t.levels[motionLabel(level)]}
        </span>
      </div>
      {!compact && <p className="mb-4 text-footnote text-muted">{t.hint}</p>}
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

export function MotionPicker() {
  return (
    <Panel>
      <MotionSlider />
    </Panel>
  );
}
