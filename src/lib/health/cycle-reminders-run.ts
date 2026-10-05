"use client";

import { type Channel, notificationStatus, replaceNotifications } from "@/lib/notifications";
import type { CycleStatus } from "./cycle";
import { CHANNEL_CYCLE, CYCLE_ID_BASE, CYCLE_ID_MAX, type CyclePrefs, type ReminderTexts, planCycleReminders } from "./cycle-reminders";

// Riprogramma i promemoria del ciclo sul telefono (caricato solo nell'app nativa).
// Senza permesso, senza accesso al Ciclo o con i promemoria spenti: li toglie.

let queue: Promise<void> = Promise.resolve();

export function scheduleCycleReminders(ctx: {
  status: CycleStatus | null;
  prefs: CyclePrefs;
  texts: ReminderTexts;
  channel: Pick<Channel, "name" | "description">;
}): Promise<void> {
  queue = queue.then(async () => {
    const permission = await notificationStatus();
    if (permission === "unavailable") return;
    const plan = permission === "granted" ? planCycleReminders({ now: new Date(), status: ctx.status, prefs: ctx.prefs, texts: ctx.texts }) : [];
    // Canale "privato": sullo schermo bloccato di Android si vede solo il nome dell'app.
    await replaceNotifications({ min: CYCLE_ID_BASE, max: CYCLE_ID_MAX }, [{ id: CHANNEL_CYCLE, ...ctx.channel, importance: 3, visibility: 0 }], plan);
  });
  return queue;
}
