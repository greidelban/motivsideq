"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { appearance, paletteFor } from "@/lib/light/appearance";
import { paletteHex } from "@/lib/light/palettes";
import { useHydrated } from "@/lib/storage/local-store";
import { paletteSwatch } from "./WallpaperPicker";
import { WALLPAPER_PREVIEWS } from "./previews";

// In Impostazioni gli sfondi non sono subito in vista: si aprono da qui.
export function WallpaperButton() {
  const { dict } = useI18n();
  const t = dict.settings.wallpaper;
  const settings = appearance.use();
  const hydrated = useHydrated();
  const { background } = settings;
  const palette = paletteFor(settings, background);

  return (
    <Link
      href="/settings/wallpaper"
      className="glass-elevated flex items-center gap-4 rounded-xl p-4 transition-transform duration-150 active:scale-[0.99]"
    >
      <span
        className="relative block size-14 shrink-0 overflow-hidden rounded-lg shadow-[inset_0_0_0_0.5px_var(--card-line)]"
        style={{ background: WALLPAPER_PREVIEWS[background] }}
        aria-hidden="true"
      >
        <span
          className="absolute right-1 bottom-1 size-4 rounded-full shadow-[0_0_0_1.5px_var(--bg)]"
          style={{ background: paletteSwatch(paletteHex(background, palette)) }}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-headline font-semibold">{t.button}</span>
        <span className="block truncate text-footnote text-muted">
          {hydrated ? `${dict.settings.background.options[background].name} · ${t.palettes[palette]}` : t.open}
        </span>
      </span>
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden="true">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
