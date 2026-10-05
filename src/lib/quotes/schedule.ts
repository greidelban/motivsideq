import type { Locale } from "@/i18n/config";
import { interpolate } from "@/i18n/format";
import { addDays, daysBetween, localDateKey } from "@/lib/dates";
import { quoteFor } from "./pick";
import { inQuietHours, isPaused, type QuotePreferences, sponsoredAllowed } from "./preferences";
import { type SponsorLogEntry, type SponsorSlot, slotsForDay, sponsorAllowed, sponsorText } from "./sponsor";
import type { QuoteTexts } from "./texts";

// Pianificazione delle notifiche LOCALI delle frasi (logica pura, testata).
// Il telefono le programma in anticipo: nessun server, nessun token push.
// Il testo contiene solo la frase (dall'archivio o dallo sponsor) e un titolo
// fisso: mai nome, dati o numeri dell'utente. Qui non entra nessun dato personale.

/** iOS tiene al massimo 64 notifiche locali in attesa per app (le altre le scarta). */
export const IOS_PENDING_LIMIT = 64;
/** Posti lasciati liberi per gli altri promemoria dell'app (ciclo: 2, poi timer di recupero…). */
export const RESERVED_FOR_OTHER_NOTIFICATIONS = 14;
export const QUOTE_NOTIFICATION_BUDGET = IOS_PENDING_LIMIT - RESERVED_FOR_OTHER_NOTIFICATIONS;
/** Giorni programmati in anticipo: a ogni apertura dell'app la finestra si sposta in avanti. */
export const HORIZON_DAYS = 14;

/** Le notifiche delle frasi usano id in questo intervallo: si cancellano solo le nostre. */
export const QUOTE_ID_BASE = 71_000;
export const QUOTE_ID_MAX = QUOTE_ID_BASE + 999;

/** Canali Android: gli sponsor in un canale separato, che si può spegnere a parte. */
export const CHANNEL_QUOTES = "daily-quotes";
export const CHANNEL_SPONSORED = "sponsored-quotes";

/** Il registro degli sponsor conserva solo quanto serve ai limiti di frequenza. */
const LOG_KEEP_DAYS = 60;

export type PlannedNotification = {
  id: number;
  at: number;
  day: string;
  title: string;
  body: string;
  channelId: typeof CHANNEL_QUOTES | typeof CHANNEL_SPONSORED;
  sponsor: string | null;
};

export type PlanInput = {
  now: Date;
  prefs: QuotePreferences;
  locale: Locale;
  /** Testi delle frasi nella lingua dell'utente (texts/<lingua>.ts). */
  quoteTexts: QuoteTexts;
  /** Titoli dal dizionario: `sponsoredTitle` contiene {brand}. */
  texts: { title: string; sponsoredTitle: string };
  sponsorSlots: readonly SponsorSlot[];
  sponsorLog: readonly SponsorLogEntry[];
  budget?: number;
};

export type Plan = { notifications: PlannedNotification[]; sponsorLog: SponsorLogEntry[] };

function atTime(day: string, hhmm: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
}

export function planNotifications(input: PlanInput): Plan {
  const { now, prefs, locale, texts } = input;
  const nowMs = now.getTime();
  const today = localDateKey(now);
  const budget = Math.min(input.budget ?? QUOTE_NOTIFICATION_BUDGET, QUOTE_NOTIFICATION_BUDGET);

  // Le voci future del registro erano solo programmate: si ripianificano adesso.
  const log = input.sponsorLog.filter((e) => e.at <= nowMs && daysBetween(e.day, today) <= LOG_KEEP_DAYS);
  if (!prefs.notify) return { notifications: [], sponsorLog: log };

  const times = [...new Set(prefs.times)].sort();
  const candidates: { day: string; slot: number; at: number }[] = [];
  for (let d = 0; d < HORIZON_DAYS; d++) {
    const day = addDays(today, d);
    times.forEach((time, slot) => {
      const at = atTime(day, time).getTime();
      if (at <= nowMs || inQuietHours(time, prefs.quiet)) return;
      if (isPaused(prefs, at)) return;
      candidates.push({ day, slot, at });
    });
  }

  const sponsorsOn = sponsoredAllowed(prefs);
  const sponsoredDays = new Set<string>();
  const notifications = candidates.slice(0, budget).map(({ day, slot, at }, i): PlannedNotification | null => {
    const base = { id: QUOTE_ID_BASE + i, at, day };
    // La notifica sponsorizzata prende il posto della prima frase del giorno (non si aggiunge).
    if (sponsorsOn && !sponsoredDays.has(day)) {
      sponsoredDays.add(day);
      const slotOfDay = slotsForDay(input.sponsorSlots, day).find((s) => sponsorAllowed(log, s.sponsor, day));
      if (slotOfDay) {
        log.push({ sponsor: slotOfDay.sponsor, day, at });
        return {
          ...base,
          title: interpolate(texts.sponsoredTitle, { brand: slotOfDay.sponsor }),
          body: sponsorText(slotOfDay, locale),
          channelId: CHANNEL_SPONSORED,
          sponsor: slotOfDay.sponsor,
        };
      }
    }
    const body = input.quoteTexts[quoteFor(day, prefs.intensity, slot).id];
    return body ? { ...base, title: texts.title, body, channelId: CHANNEL_QUOTES, sponsor: null } : null;
  });

  return { notifications: notifications.filter((n) => n !== null), sponsorLog: log };
}
