import * as z from "zod/mini";
import { INTENSITIES } from "./categories";

// Preferenze delle Frasi del giorno. Restano solo su questo dispositivo
// (localStorage, store.ts): notifiche e consenso agli sponsor valgono per il
// telefono su cui si scelgono e non vanno nel cloud.

/** Versione del testo di consenso alle frasi sponsorizzate: se cambia, si richiede. */
export const SPONSOR_CONSENT_VERSION = 1;

export const MAX_TIMES_PER_DAY = 3;

const time = z.string().check(z.regex(/^([01]\d|2[0-3]):[0-5]\d$/));

export const quotePreferencesSchema = z.object({
  // Tono di partenza "Diretto": l'app ha una personalità un po' aggressiva.
  intensity: z._default(z.enum(INTENSITIES), "direct"),
  /** Notifiche locali attive (il permesso del sistema si chiede quando si accendono). */
  notify: z._default(z.boolean(), false),
  /** Orari delle notifiche, "HH:MM" nel fuso del dispositivo. */
  times: z._default(z.array(time).check(z.minLength(1), z.maxLength(MAX_TIMES_PER_DAY)), ["08:30"]),
  quiet: z._default(z.object({ enabled: z.boolean(), start: time, end: time }), {
    enabled: true,
    start: "22:00",
    end: "07:00",
  }),
  /** Pausa temporanea delle notifiche: fino a questo istante (ms), poi riprendono da sole. */
  pausedUntil: z._default(z.nullable(z.number()), null),
  /** Frasi sponsorizzate: solo con un consenso esplicito, mai preselezionato. */
  sponsored: z._default(
    z.object({
      optIn: z.boolean(),
      consentAt: z.nullable(z.number()),
      consentVersion: z.nullable(z.int()),
    }),
    { optIn: false, consentAt: null, consentVersion: null },
  ),
});

export type QuotePreferences = z.infer<typeof quotePreferencesSchema>;

export const DEFAULT_QUOTE_PREFERENCES: QuotePreferences = {
  intensity: "direct",
  notify: false,
  times: ["08:30"],
  quiet: { enabled: true, start: "22:00", end: "07:00" },
  pausedUntil: null,
  sponsored: { optIn: false, consentAt: null, consentVersion: null },
};

/** Il consenso agli sponsor vale solo se dato esplicitamente sul testo attuale. */
export function sponsoredAllowed(prefs: QuotePreferences): boolean {
  const s = prefs.sponsored;
  return s.optIn && s.consentAt !== null && s.consentVersion === SPONSOR_CONSENT_VERSION;
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Vero se l'orario cade nelle ore di silenzio (che possono scavalcare la mezzanotte). */
export function inQuietHours(hhmm: string, quiet: QuotePreferences["quiet"]): boolean {
  if (!quiet.enabled) return false;
  const t = minutesOf(hhmm);
  const start = minutesOf(quiet.start);
  const end = minutesOf(quiet.end);
  if (start === end) return false;
  return start < end ? t >= start && t < end : t >= start || t < end;
}

export function isPaused(prefs: QuotePreferences, now: number): boolean {
  return prefs.pausedUntil !== null && prefs.pausedUntil > now;
}
