"use client";

import { useI18n } from "@/i18n/client";
import { type Level, LEVELS, type Scale } from "@/lib/journal/journal";

// Controlli del check-in, usati nel Diario e (solo l'umore) nella scheda di Oggi.
// Al posto delle parole, che non stanno in 5 pulsanti in tutte le lingue, un
// disegno per livello; la parola del livello scelto compare accanto al titolo.

const MOUTHS: Record<Level, string> = {
  1: "M8 16.5q4-4 8 0",
  2: "M8.5 16q3.5-2 7 0",
  3: "M8.5 15.5h7",
  4: "M8.5 14.5q3.5 2.5 7 0",
  5: "M8 14q4 4.5 8 0",
};

export function MoodFace({ level, size = 24 }: { level: Level; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="0.6" fill="currentColor" />
      <circle cx="15" cy="10" r="0.6" fill="currentColor" />
      <path d={MOUTHS[level]} />
    </svg>
  );
}

/** Cinque barrette che salgono: piene fino al livello. */
function LevelBars({ level }: { level: Level }) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden="true" className="rtl:-scale-x-100">
      {LEVELS.map((l, i) => {
        const h = 4 + i * 3.5;
        return <rect key={l} x={2.5 + i * 4} y={20 - h} width={3} height={h} rx={1.5} fill="currentColor" opacity={l <= level ? 1 : 0.28} />;
      })}
    </svg>
  );
}

export function ScaleField({
  scale,
  value,
  onChange,
  labelHidden = false,
}: {
  scale: Scale;
  value: Level | undefined;
  onChange: (value: Level | undefined) => void;
  /** Titolo solo per i lettori di schermo (nella scheda di Oggi la domanda dice già tutto). */
  labelHidden?: boolean;
}) {
  const { dict } = useI18n();
  const t = dict.journal.checkIn;
  return (
    <fieldset>
      <legend className={labelHidden ? "sr-only" : "label"}>
        {t.scales[scale]}
        {!labelHidden && <span className="font-normal text-muted"> · {value ? t.levels[scale][value] : t.notSet}</span>}
      </legend>
      <div className="card flex gap-1 rounded-full p-1">
        {LEVELS.map((level) => {
          const active = value === level;
          return (
            <button
              key={level}
              type="button"
              aria-pressed={active}
              aria-label={t.levels[scale][level]}
              onClick={() => onChange(active ? undefined : level)}
              className={`grid min-h-11 flex-1 place-items-center rounded-full transition-colors duration-150 ${
                active ? "text-ink" : "text-muted hover:text-ink-2"
              }`}
              style={active ? { background: "var(--glass-lens)", boxShadow: "var(--glass-lens-edge)" } : undefined}
            >
              {scale === "mood" ? <MoodFace level={level} /> : <LevelBars level={level} />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
