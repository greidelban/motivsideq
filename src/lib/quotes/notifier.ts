"use client";

import { replaceNotifications } from "@/lib/notifications";
import { CHANNEL_QUOTES, CHANNEL_SPONSORED, type PlannedNotification, QUOTE_ID_BASE, QUOTE_ID_MAX } from "./schedule";

// Notifiche delle frasi: intervallo di id e canali Android propri (src/lib/notifications.ts).

export type ChannelTexts = { quotes: { name: string; description: string }; sponsored: { name: string; description: string } };

/** Sostituisce le notifiche delle frasi già programmate con quelle nuove. */
export function applyNotificationPlan(notifications: PlannedNotification[], channels: ChannelTexts): Promise<boolean> {
  return replaceNotifications(
    { min: QUOTE_ID_BASE, max: QUOTE_ID_MAX },
    [
      { id: CHANNEL_QUOTES, ...channels.quotes, importance: 3, visibility: 1 },
      // Canale separato per gli sponsor: si spegne a parte dalle impostazioni di Android.
      { id: CHANNEL_SPONSORED, ...channels.sponsored, importance: 2, visibility: 1 },
    ],
    notifications,
  );
}
