"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { interpolate } from "@/i18n/format";
import { localDateKey } from "@/lib/dates";
import { sponsoredAllowed } from "@/lib/quotes/preferences";
import { slotsForDay, sponsorText } from "@/lib/quotes/sponsor";
import { useSponsorSlots } from "@/lib/quotes/sponsor-feed";
import { quotePrefs } from "@/lib/quotes/store";
import { useNow } from "@/lib/use-now";

// Carta sponsor: SOLO nella pagina Oggi (mai in Ciclo, Cibo, Allenamento o peso:
// lo controlla placement.test.ts), solo con il consenso e solo nel giorno dello slot.
// Nessun link verso lo sponsor: niente clic da tracciare.
export function SponsorCard() {
  const { locale, dict } = useI18n();
  const prefs = quotePrefs.use();
  const slots = useSponsorSlots();
  const now = useNow();
  const slot = sponsoredAllowed(prefs) && now ? slotsForDay(slots, localDateKey(now))[0] : undefined;
  if (!slot) return null;

  const label = interpolate(dict.quotes.sponsorCard.label, { brand: slot.sponsor });
  return (
    <section className="glass-elevated rounded-xl p-5" aria-label={label}>
      <p className="eyebrow mb-2">{label}</p>
      <p className="text-callout text-balance">{sponsorText(slot, locale)}</p>
      <Link href="/settings/quotes#sponsored" className="link mt-3 inline-flex min-h-11 items-center text-footnote">
        {dict.quotes.sponsorCard.why}
      </Link>
    </section>
  );
}
