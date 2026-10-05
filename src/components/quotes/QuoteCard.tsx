"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { localDateKey } from "@/lib/dates";
import { quoteFor } from "@/lib/quotes/pick";
import { quotePrefs } from "@/lib/quotes/store";
import { useQuoteTexts } from "@/lib/quotes/use-quote-texts";
import { useHydrated } from "@/lib/storage/local-store";
import { useNow } from "@/lib/use-now";

// "Frase del giorno" in Oggi: il giorno si calcola sul telefono, l'intensità è
// quella scelta in Impostazioni. È la stessa frase della prima notifica.
// Il testo arriva dal file della lingua (caricato a parte, solo quello).
export function QuoteCard() {
  const { locale, dict } = useI18n();
  const t = dict.quotes;
  const prefs = quotePrefs.use();
  const hydrated = useHydrated();
  const now = useNow();
  const texts = useQuoteTexts(locale);
  const quote = hydrated && now && texts ? quoteFor(localDateKey(now), prefs.intensity) : null;

  return (
    <section className="glass-elevated rounded-xl p-5" aria-labelledby="quote-of-the-day">
      <p id="quote-of-the-day" className="eyebrow mb-2">
        {t.card.eyebrow}
        {quote && ` · ${t.categories[quote.category]}`}
      </p>
      {/* Una riga riservata prima di leggere le preferenze: la pagina quasi non salta. */}
      <blockquote className="min-h-[1.5em] text-title3 font-semibold text-balance">
        {quote ? texts?.[quote.id] : null}
      </blockquote>
      <Link href="/settings/quotes" className="link mt-1 inline-flex min-h-11 items-center text-subhead">
        {t.card.settings}
      </Link>
    </section>
  );
}
