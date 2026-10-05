"use client";

import { nativeApp } from "@/lib/native";

// Notifiche LOCALI: le programma il telefono stesso, senza server né token push.
// Si usa il plugin LocalNotifications di Capacitor quando l'app gira come app
// nativa (iPhone, Android). Nel browser non c'è.
// Ogni funzione (frasi, ciclo…) ha il suo intervallo di id e tocca solo quello.

type NativePermission = { display: "granted" | "denied" | "prompt" | "prompt-with-rationale" };

type NativeNotification = {
  id: number;
  title: string;
  body: string;
  schedule: { at: Date; allowWhileIdle: boolean };
  channelId?: string;
};

type LocalNotificationsPlugin = {
  checkPermissions(): Promise<NativePermission>;
  requestPermissions(): Promise<NativePermission>;
  getPending(): Promise<{ notifications: { id: number | string }[] }>;
  cancel(options: { notifications: { id: number }[] }): Promise<void>;
  schedule(options: { notifications: NativeNotification[] }): Promise<unknown>;
  createChannel(channel: { id: string; name: string; description: string; importance: 1 | 2 | 3 | 4 | 5; visibility?: -1 | 0 | 1 }): Promise<void>;
};

function native(): { plugin: LocalNotificationsPlugin; platform: string } | null {
  const cap = nativeApp();
  const plugin = cap?.Plugins?.LocalNotifications as LocalNotificationsPlugin | undefined;
  return cap && plugin ? { plugin, platform: cap.getPlatform?.() ?? "unknown" } : null;
}

export type NotificationStatus = "granted" | "denied" | "prompt" | "unavailable";

const toStatus = (p: NativePermission): NotificationStatus => (p.display === "granted" ? "granted" : p.display === "denied" ? "denied" : "prompt");

export async function notificationStatus(): Promise<NotificationStatus> {
  const n = native();
  if (!n) return "unavailable";
  try {
    return toStatus(await n.plugin.checkPermissions());
  } catch {
    return "unavailable";
  }
}

/** Chiede il permesso (solo quando l'utente accende le notifiche). */
export async function requestNotifications(): Promise<NotificationStatus> {
  const n = native();
  if (!n) return "unavailable";
  try {
    return toStatus(await n.plugin.requestPermissions());
  } catch {
    return "denied";
  }
}

export type Channel = {
  id: string;
  name: string;
  description: string;
  importance: 1 | 2 | 3 | 4 | 5;
  /** Android: 1 = testo visibile sullo schermo bloccato, 0 = solo il nome dell'app. */
  visibility: 0 | 1;
};

export type LocalNotification = { id: number; at: number; title: string; body: string; channelId: string };

/**
 * Sostituisce le notifiche programmate con id in [min, max] con quelle nuove.
 * Le notifiche delle altre funzioni restano. Falso se non è un'app nativa o se fallisce.
 */
export async function replaceNotifications(range: { min: number; max: number }, channels: Channel[], notifications: LocalNotification[]): Promise<boolean> {
  const n = native();
  if (!n) return false;
  try {
    if (n.platform === "android") {
      for (const channel of channels) await n.plugin.createChannel(channel);
    }
    const pending = await n.plugin.getPending();
    const ours = pending.notifications.map((p) => Number(p.id)).filter((id) => id >= range.min && id <= range.max);
    if (ours.length) await n.plugin.cancel({ notifications: ours.map((id) => ({ id })) });
    if (notifications.length) {
      await n.plugin.schedule({
        notifications: notifications.map((p) => ({
          id: p.id,
          title: p.title,
          body: p.body,
          schedule: { at: new Date(p.at), allowWhileIdle: true },
          channelId: p.channelId,
        })),
      });
    }
    return true;
  } catch {
    return false;
  }
}
