"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { plural } from "@/i18n/format";
import { APP_NAME } from "@/lib/app";
import { localDateKey } from "@/lib/dates";
import { cycleStatus } from "@/lib/health/cycle";
import { canUseCycle } from "@/lib/health/cycle-access";
import { cyclePrefs } from "@/lib/health/cycle-prefs";
import { cycleConsent, cyclePeriods } from "@/lib/health/store";
import { nativeApp } from "@/lib/native";
import { profile } from "@/lib/profile/store";
import { useLocalData } from "@/lib/storage/db";

// Senza interfaccia: nell'app nativa riprogramma i promemoria del ciclo quando
// cambiano dati, preferenze o lingua, e a ogni ritorno nell'app. Se il Ciclo non
// è (più) accessibile, li toglie. Nel browser non fa nulla.
export function CycleReminderScheduler() {
  const { locale, dict } = useI18n();
  const ready = useLocalData();
  const prof = profile.use();
  const consent = cycleConsent.use();
  const periods = cyclePeriods.use();
  const prefs = cyclePrefs.use();
  const t = dict.health.cycle.reminders;

  useEffect(() => {
    if (!ready || !nativeApp()) return;
    const run = () => {
      const allowed = canUseCycle(prof, consent) === "ok";
      import("@/lib/health/cycle-reminders-run").then(({ scheduleCycleReminders }) =>
        scheduleCycleReminders({
          status: allowed ? cycleStatus(periods, localDateKey()) : null,
          prefs: allowed ? prefs : { ...prefs, reminders: false },
          texts: {
            title: APP_NAME,
            discreet: t.notification.discreet,
            detailed: (n) => plural(locale, n, t.notification.detailed),
          },
          channel: { name: t.notification.channel, description: t.notification.channelHint },
        }),
      );
    };
    run();
    const onVisible = () => {
      if (!document.hidden) run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ready, prof, consent, periods, prefs, locale, t]);

  return null;
}
