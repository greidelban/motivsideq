"use client";

import type { Locale } from "@/i18n/config";
import { notificationStatus } from "@/lib/notifications";
import { applyNotificationPlan, type ChannelTexts } from "./notifier";
import { planNotifications } from "./schedule";
import type { SponsorSlot } from "./sponsor";
import { loadQuoteTexts } from "./texts";
import { quotePrefs, sponsorLog } from "./store";

// Riprogramma le notifiche delle frasi sul telefono (caricato solo nell'app nativa).
// Si richiama a ogni apertura dell'app e quando cambiano le preferenze: la
// finestra dei prossimi giorni si sposta in avanti.

export type ScheduleContext = {
  locale: Locale;
  texts: { title: string; sponsoredTitle: string };
  channels: ChannelTexts;
  sponsorSlots: readonly SponsorSlot[];
};

let queue: Promise<void> = Promise.resolve();

export function scheduleQuoteNotifications(ctx: ScheduleContext): Promise<void> {
  // Una alla volta: due riprogrammazioni insieme potrebbero lasciare doppioni.
  queue = queue.then(async () => {
    const prefs = quotePrefs.get();
    const status = await notificationStatus();
    if (status === "unavailable") return;
    const plan = planNotifications({
      now: new Date(),
      // Senza permesso non si programma nulla (e si tolgono quelle vecchie).
      prefs: status === "granted" ? prefs : { ...prefs, notify: false },
      locale: ctx.locale,
      quoteTexts: await loadQuoteTexts(ctx.locale),
      texts: ctx.texts,
      sponsorSlots: ctx.sponsorSlots,
      sponsorLog: sponsorLog.get(),
    });
    if (await applyNotificationPlan(plan.notifications, ctx.channels)) sponsorLog.set(plan.sponsorLog);
  });
  return queue;
}
