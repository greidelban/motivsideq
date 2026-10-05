"use client";

import { useEffect, useState } from "react";
import { Segmented } from "@/components/brain/Segmented";
import { Check } from "@/components/Check";
import { Panel } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { interpolate, plural } from "@/i18n/format";
import { APP_NAME } from "@/lib/app";
import { cyclePrefs } from "@/lib/health/cycle-prefs";
import { DAYS_BEFORE } from "@/lib/health/cycle-reminders";
import { type NotificationStatus, notificationStatus, requestNotifications } from "@/lib/notifications";
import { Notice } from "./Chip";

// Promemoria prima del ciclo (discreti di default) e scheda nella pagina Oggi.
export function CycleReminders() {
  const { locale, dict } = useI18n();
  const t = dict.health.cycle.reminders;
  const prefs = cyclePrefs.use();
  const [status, setStatus] = useState<NotificationStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    notificationStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function setReminders(on: boolean) {
    if (!on) return cyclePrefs.set((p) => ({ ...p, reminders: false }));
    const next = status === "granted" ? "granted" : await requestNotifications();
    setStatus(next);
    if (next === "granted") cyclePrefs.set((p) => ({ ...p, reminders: true }));
  }

  return (
    <Panel>
      <h2 className="mb-2 text-headline font-semibold">{t.title}</h2>
      <Check
        label={t.enable}
        checked={prefs.reminders && status === "granted"}
        disabled={status === null || status === "unavailable"}
        onChange={setReminders}
      />
      {status === "unavailable" && <p className="mt-1 text-footnote text-muted">{t.unavailable}</p>}
      {status === "denied" && <Notice tone="warning">{interpolate(t.denied, { app: APP_NAME })}</Notice>}

      <div className="mt-3">
        <Segmented
          label={t.daysBefore}
          options={DAYS_BEFORE.map((value) => ({ value, label: plural(locale, value, t.days) }))}
          value={prefs.daysBefore}
          onChange={(daysBefore) => cyclePrefs.set((p) => ({ ...p, daysBefore }))}
        />
      </div>

      <div className="mt-3">
        <Check label={t.discreet} checked={prefs.discreet} onChange={(discreet) => cyclePrefs.set((p) => ({ ...p, discreet }))} />
        <p className="text-footnote text-muted">{t.discreetHint}</p>
      </div>

      <div className="mt-3">
        <Check label={t.showInToday} checked={prefs.showInToday} onChange={(showInToday) => cyclePrefs.set((p) => ({ ...p, showInToday }))} />
        <p className="text-footnote text-muted">{t.showInTodayHint}</p>
      </div>
    </Panel>
  );
}
