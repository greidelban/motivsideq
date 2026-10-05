"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/format";
import { isPaused } from "@/lib/quotes/preferences";
import { quotePrefs } from "@/lib/quotes/store";
import { useHydrated } from "@/lib/storage/local-store";
import { useNow } from "@/lib/use-now";

// In Impostazioni: apre la pagina delle Frasi del giorno, con un riassunto delle scelte.
export function QuotesButton() {
  const { dict } = useI18n();
  const t = dict.quotes.settings;
  const prefs = quotePrefs.use();
  const hydrated = useHydrated();
  const now = useNow();
  const intensity = dict.quotes.intensity[prefs.intensity];
  const summary = !hydrated
    ? dict.quotes.card.settings
    : !prefs.notify
      ? interpolate(t.summaryOff, { intensity })
      : now && isPaused(prefs, now.getTime())
        ? interpolate(t.summaryPaused, { intensity })
        : interpolate(t.summaryOn, { intensity, times: [...prefs.times].sort().join(", ") });

  return (
    <Link
      href="/settings/quotes"
      className="glass-elevated flex items-center gap-4 rounded-xl p-4 transition-transform duration-150 active:scale-[0.99]"
    >
      {/* Virgolette come icona, alte quanto l'anteprima dello Sfondo qui sotto. */}
      <span className="card grid size-14 shrink-0 place-items-center rounded-lg font-serif text-[2.5rem] leading-none text-secondary" aria-hidden="true">
        <span className="translate-y-2">“</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-headline font-semibold">{t.button}</span>
        <span className="block truncate text-footnote text-muted">{summary}</span>
      </span>
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted rtl:-scale-x-100" aria-hidden="true">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
