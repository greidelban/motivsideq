"use client";

import { MotionSlider } from "@/components/MotionPicker";
import { useI18n } from "@/i18n/client";
import { appearance, paletteFor } from "@/lib/light/appearance";
import { BACKGROUNDS } from "@/lib/light/backgrounds";
import { pulseLight } from "@/lib/light/bus";
import { PALETTE_IDS, type PaletteHex, paletteHex } from "@/lib/light/palettes";
import { WALLPAPER_PREVIEWS } from "./previews";

export function paletteSwatch([light, mid, deep, accent]: PaletteHex): string {
  return `linear-gradient(135deg, ${light}, ${mid} 40%, ${deep} 72%, ${accent})`;
}

// Pannello in basso della pagina Wallpaper: sopra resta libero per vedere lo
// sfondo vero, che cambia subito a ogni scelta.
export function WallpaperPicker() {
  const { dict } = useI18n();
  const t = dict.settings.wallpaper;
  const names = dict.settings.background.options;
  const settings = appearance.use();
  const { background } = settings;
  const palette = paletteFor(settings, background);

  return (
    <section className="glass-elevated rounded-xl p-4">
      <h2 id="wp-backgrounds" className="eyebrow mb-2">
        {t.backgrounds}
      </h2>
      <div role="radiogroup" aria-labelledby="wp-backgrounds" className="grid grid-cols-3 gap-2.5">
        {BACKGROUNDS.map((id) => {
          const selected = id === background;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                appearance.set((s) => ({ ...s, background: id }));
                pulseLight(0.4);
              }}
              className="flex flex-col gap-1.5 text-left"
            >
              <span
                className={`block aspect-square w-full rounded-lg transition-shadow duration-150 ${
                  selected ? "shadow-[0_0_0_2px_var(--primary)]" : "shadow-[inset_0_0_0_0.5px_var(--card-line)]"
                }`}
                style={{ background: WALLPAPER_PREVIEWS[id] }}
                aria-hidden="true"
              />
              <span className={`truncate text-footnote font-semibold ${selected ? "text-ink" : "text-ink-2"}`}>
                {names[id].name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 mb-2 flex items-baseline justify-between gap-3">
        <h2 id="wp-colors" className="eyebrow">
          {t.colors}
        </h2>
        <span className="text-footnote font-semibold text-secondary">{t.palettes[palette]}</span>
      </div>
      <div role="radiogroup" aria-labelledby="wp-colors" className="grid grid-cols-5 gap-3">
        {PALETTE_IDS.map((id) => {
          const selected = id === palette;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t.palettes[id]}
              title={t.palettes[id]}
              onClick={() => {
                appearance.set((s) => ({ ...s, palettes: { ...s.palettes, [background]: id } }));
                pulseLight(0.5);
              }}
              className={`mx-auto block aspect-square w-full max-w-12 rounded-full transition-[box-shadow,transform] duration-150 active:scale-95 ${
                selected
                  ? "shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--primary)]"
                  : "shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.25)]"
              }`}
              style={{ background: paletteSwatch(paletteHex(background, id)) }}
            />
          );
        })}
      </div>

      {/* Quanto si muove lo sfondo (lo stesso livello di Impostazioni → Animazioni). */}
      <div className="mt-4 border-t border-hairline pt-3">
        <MotionSlider id="wp-motion" compact />
      </div>
    </section>
  );
}
