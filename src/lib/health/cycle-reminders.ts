import * as z from "zod/mini";
import { addDays } from "@/lib/dates";
import { type CycleStatus, upcomingStarts } from "./cycle";

// Promemoria del ciclo (logica pura): notifiche LOCALI prima del ciclo previsto.
// Discrete di default: sullo schermo bloccato non si capisce di cosa parlano
// (sono dati sanitari). Restano sul dispositivo, come le preferenze.

/** Id riservati ai promemoria del ciclo (le frasi usano 71000-71999). */
export const CYCLE_ID_BASE = 72_000;
export const CYCLE_ID_MAX = CYCLE_ID_BASE + 9;
export const CHANNEL_CYCLE = "cycle-reminders";
/** Cicli futuri con un promemoria già programmato (si riprogramma a ogni apertura). */
const REMINDED_CYCLES = 2;
const REMINDER_HOUR = 9;

export const DAYS_BEFORE = [1, 2, 3] as const;

export const cyclePrefsSchema = z.object({
  reminders: z._default(z.boolean(), false),
  daysBefore: z._default(z.union([z.literal(1), z.literal(2), z.literal(3)]), 2),
  /** Testo che non rivela nulla (vero di default). */
  discreet: z._default(z.boolean(), true),
  /** La scheda del ciclo nella pagina Oggi. */
  showInToday: z._default(z.boolean(), true),
});
export type CyclePrefs = z.infer<typeof cyclePrefsSchema>;

export const DEFAULT_CYCLE_PREFS: CyclePrefs = { reminders: false, daysBefore: 2, discreet: true, showInToday: true };

export type CycleReminder = { id: number; at: number; title: string; body: string; channelId: typeof CHANNEL_CYCLE };

export type ReminderTexts = {
  /** Titolo neutro (il nome dell'app). */
  title: string;
  /** Testo discreto: non dice di cosa si tratta. */
  discreet: string;
  /** Testo esplicito, con i giorni mancanti. */
  detailed: (daysBefore: number) => string;
};

export function planCycleReminders(input: {
  now: Date;
  status: CycleStatus | null;
  prefs: CyclePrefs;
  texts: ReminderTexts;
}): CycleReminder[] {
  const { now, status, prefs, texts } = input;
  if (!prefs.reminders || !status) return [];
  return upcomingStarts(status, REMINDED_CYCLES)
    .map((start) => {
      const [y, m, d] = addDays(start, -prefs.daysBefore).split("-").map(Number);
      return new Date(y, m - 1, d, REMINDER_HOUR).getTime();
    })
    .filter((at) => at > now.getTime())
    .map((at, i) => ({
      id: CYCLE_ID_BASE + i,
      at,
      title: texts.title,
      body: prefs.discreet ? texts.discreet : texts.detailed(prefs.daysBefore),
      channelId: CHANNEL_CYCLE,
    }));
}
