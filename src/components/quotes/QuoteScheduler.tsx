"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { nativeApp } from "@/lib/native";
import { sponsoredAllowed } from "@/lib/quotes/preferences";
import { refreshSponsorFeed, useSponsorSlots } from "@/lib/quotes/sponsor-feed";
import { quotePrefs } from "@/lib/quotes/store";

// Senza interfaccia: aggiorna il file sponsor (solo con il consenso) e, nell'app
// nativa, riprogramma le notifiche locali delle frasi. Nel browser non programma nulla.
export function QuoteScheduler() {
  const { locale, dict } = useI18n();
  const prefs = quotePrefs.use();
  const slots = useSponsorSlots();
  const sponsorsOn = sponsoredAllowed(prefs);
  const t = dict.quotes.notification;

  useEffect(() => {
    if (!sponsorsOn) return;
    refreshSponsorFeed();
    const onVisible = () => {
      if (!document.hidden) refreshSponsorFeed();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [sponsorsOn]);

  useEffect(() => {
    if (!nativeApp()) return;
    const run = () =>
      // Il codice delle notifiche (con l'archivio delle frasi) si carica solo nell'app nativa.
      import("@/lib/quotes/run").then(({ scheduleQuoteNotifications }) =>
        scheduleQuoteNotifications({
          locale,
          texts: { title: t.title, sponsoredTitle: t.sponsoredTitle },
          channels: {
            quotes: { name: t.channel, description: t.channelHint },
            sponsored: { name: t.sponsoredChannel, description: t.sponsoredChannelHint },
          },
          sponsorSlots: slots,
        }),
      );
    run();
    const onVisible = () => {
      if (!document.hidden) run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [prefs, slots, locale, t]);

  return null;
}
