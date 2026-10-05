import * as z from "zod/mini";
import { LOCALES, type Locale } from "@/i18n/config";
import { daysBetween } from "@/lib/dates";
import { isAllowedText } from "./content-rules";

// Frasi sponsorizzate: un file di contenuti FIRMATO che l'app scarica (nessun
// server nostro, nessun dato inviato: la stessa richiesta per tutti).
// Formato del file:
//   { "v": 1, "payload": "<JSON come testo>", "signature": "<base64>" }
// La firma è ECDSA P-256 / SHA-256 sui byte UTF-8 di `payload` (formato r||s,
// quello di WebCrypto). La chiave privata resta fuori dal progetto
// (scripts/sponsor-keys.mjs); nell'app c'è solo quella pubblica.
// Il payload:
//   { "v": 1, "issuedAt": "...", "slots": [{ "id", "sponsor", "date", "text": { "en", "it" } }] }
// Ogni slot vale solo nel suo giorno (`date`, nel fuso del telefono); al massimo 10.

export const MAX_SPONSOR_SLOTS = 10;
/** Al massimo una notifica sponsorizzata ogni 7 giorni, in totale. */
export const SPONSOR_GAP_DAYS = 7;
/** Al massimo una notifica dello stesso sponsor ogni 30 giorni. */
export const SAME_SPONSOR_GAP_DAYS = 30;
/** Il file non può superare questa dimensione (protegge memoria e spazio). */
export const MAX_FEED_BYTES = 64_000;

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
// Niente link (nessun tracciamento dai clic) e niente caratteri di controllo.
const LINK = /(https?:|www\.|[a-z0-9-]+\.(com|net|org|it|io|app|co|me|ly)\b)/i;
const CONTROL = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/;

const text = (max: number) => z.string().check(z.minLength(1), z.maxLength(max));
const isClean = (s: string) => s.trim() === s && !LINK.test(s) && !CONTROL.test(s);

const slotSchema = z.object({
  id: z.string().check(z.regex(/^[a-z0-9-]{1,40}$/)),
  sponsor: text(40),
  date: z.string().check(z.regex(DAY)),
  text: z.record(z.string(), text(200)),
});

const payloadSchema = z.object({
  v: z.literal(1),
  issuedAt: z.string(),
  slots: z.array(slotSchema).check(z.maxLength(MAX_SPONSOR_SLOTS)),
});

const envelopeSchema = z.object({
  v: z.literal(1),
  payload: z.string().check(z.maxLength(MAX_FEED_BYTES)),
  signature: z.string().check(z.maxLength(200)),
});

export type SponsorSlot = { id: string; sponsor: string; date: string; text: Partial<Record<Locale, string>> & { en: string } };

export type FeedResult =
  | { ok: true; slots: SponsorSlot[]; dropped: number }
  | { ok: false; reason: "format" | "signature" | "payload" | "unsupported" };

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> | null {
  try {
    const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Uno slot si usa solo se ha il testo inglese, nessun link e nessun tema vietato
 * in nessuna lingua; gli altri slot del file restano validi.
 */
function acceptSlot(slot: z.infer<typeof slotSchema>): SponsorSlot | null {
  if (!isClean(slot.sponsor) || LOCALES.some((locale) => !isAllowedText(slot.sponsor, locale))) return null;
  const texts: Partial<Record<Locale, string>> = {};
  for (const locale of LOCALES) {
    const value = slot.text[locale];
    if (value === undefined) continue;
    if (!isClean(value) || !isAllowedText(value, locale)) return null;
    texts[locale] = value;
  }
  if (!texts.en) return null;
  return { id: slot.id, sponsor: slot.sponsor, date: slot.date, text: { ...texts, en: texts.en } };
}

/**
 * Verifica la firma del file e ne estrae gli slot accettabili.
 * Senza firma valida non si usa nulla (nemmeno gli slot che sembrano corretti).
 */
export async function verifySponsorFeed(raw: string, publicKeySpkiB64: string): Promise<FeedResult> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return { ok: false, reason: "unsupported" };
  if (raw.length > MAX_FEED_BYTES * 2) return { ok: false, reason: "format" };

  let envelope: z.infer<typeof envelopeSchema>;
  try {
    const parsed = z.safeParse(envelopeSchema, JSON.parse(raw));
    if (!parsed.success) return { ok: false, reason: "format" };
    envelope = parsed.data;
  } catch {
    return { ok: false, reason: "format" };
  }

  const keyBytes = base64ToBytes(publicKeySpkiB64);
  const signature = base64ToBytes(envelope.signature);
  if (!keyBytes || !signature) return { ok: false, reason: "signature" };
  try {
    const key = await subtle.importKey("spki", keyBytes, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const valid = await subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      signature,
      new TextEncoder().encode(envelope.payload),
    );
    if (!valid) return { ok: false, reason: "signature" };
  } catch {
    return { ok: false, reason: "signature" };
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    const parsed = z.safeParse(payloadSchema, JSON.parse(envelope.payload));
    if (!parsed.success) return { ok: false, reason: "payload" };
    payload = parsed.data;
  } catch {
    return { ok: false, reason: "payload" };
  }

  const slots = payload.slots.map(acceptSlot).filter((s): s is SponsorSlot => s !== null);
  return { ok: true, slots, dropped: payload.slots.length - slots.length };
}

/** Slot validi nel giorno `day` (uno slot dura un solo giorno), in ordine stabile. */
export function slotsForDay(slots: readonly SponsorSlot[], day: string): SponsorSlot[] {
  return slots.filter((s) => s.date === day).sort((a, b) => a.id.localeCompare(b.id));
}

export function sponsorText(slot: SponsorSlot, locale: Locale): string {
  return slot.text[locale] ?? slot.text.en;
}

/** Notifiche sponsorizzate già mandate (o programmate) da questo dispositivo. */
export type SponsorLogEntry = { sponsor: string; day: string; at: number };

const sameSponsor = (a: string, b: string) => a.trim().toLocaleLowerCase("en") === b.trim().toLocaleLowerCase("en");

/** Limiti di frequenza: 1 a settimana in totale, 1 al mese per sponsor (finestre mobili, in giorni). */
export function sponsorAllowed(log: readonly SponsorLogEntry[], sponsor: string, day: string): boolean {
  return log.every((entry) => {
    const gap = Math.abs(daysBetween(entry.day, day));
    if (gap < SPONSOR_GAP_DAYS) return false;
    return !(sameSponsor(entry.sponsor, sponsor) && gap < SAME_SPONSOR_GAP_DAYS);
  });
}
