import { beforeAll, describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { QUOTES } from "./archive";
import { en as EN_TEXTS } from "./texts/en";
import { it as IT_TEXTS } from "./texts/it";
import { DEFAULT_QUOTE_PREFERENCES, type QuotePreferences, SPONSOR_CONSENT_VERSION } from "./preferences";
import {
  CHANNEL_QUOTES,
  CHANNEL_SPONSORED,
  HORIZON_DAYS,
  IOS_PENDING_LIMIT,
  QUOTE_ID_BASE,
  QUOTE_ID_MAX,
  QUOTE_NOTIFICATION_BUDGET,
  planNotifications,
} from "./schedule";
import {
  MAX_SPONSOR_SLOTS,
  type SponsorLogEntry,
  type SponsorSlot,
  slotsForDay,
  sponsorAllowed,
  verifySponsorFeed,
} from "./sponsor";

// --- Firma ------------------------------------------------------------------------

const toB64 = (buf: ArrayBuffer) => Buffer.from(buf).toString("base64");

let keys: CryptoKeyPair;
let publicKey: string;
let otherPublicKey: string;

beforeAll(async () => {
  const params = { name: "ECDSA", namedCurve: "P-256" } as const;
  keys = await crypto.subtle.generateKey(params, true, ["sign", "verify"]);
  publicKey = toB64(await crypto.subtle.exportKey("spki", keys.publicKey));
  const other = await crypto.subtle.generateKey(params, true, ["sign", "verify"]);
  otherPublicKey = toB64(await crypto.subtle.exportKey("spki", other.publicKey));
});

type RawSlot = { id: string; sponsor: string; date: string; text: Record<string, string> };

const slot = (over: Partial<RawSlot> = {}): RawSlot => ({
  id: "acme-1",
  sponsor: "Acme",
  date: "2026-10-06",
  text: { en: "Small steps, every day.", it: "Piccoli passi, ogni giorno." },
  ...over,
});

async function signedFeed(slots: RawSlot[], tamper?: (payload: string) => string): Promise<string> {
  const payload = JSON.stringify({ v: 1, issuedAt: "2026-10-05T08:00:00Z", slots });
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.privateKey,
    new TextEncoder().encode(payload),
  );
  return JSON.stringify({ v: 1, payload: tamper ? tamper(payload) : payload, signature: toB64(signature) });
}

describe("verifica della firma", () => {
  it("accetta un file firmato con la nostra chiave", async () => {
    const result = await verifySponsorFeed(await signedFeed([slot()]), publicKey);
    expect(result).toEqual({
      ok: true,
      dropped: 0,
      slots: [{ id: "acme-1", sponsor: "Acme", date: "2026-10-06", text: { en: "Small steps, every day.", it: "Piccoli passi, ogni giorno." } }],
    });
  });

  it("rifiuta un file modificato dopo la firma", async () => {
    const raw = await signedFeed([slot()], (p) => p.replace("Small steps", "Big steps"));
    expect(await verifySponsorFeed(raw, publicKey)).toEqual({ ok: false, reason: "signature" });
  });

  it("rifiuta un file firmato con un'altra chiave", async () => {
    expect(await verifySponsorFeed(await signedFeed([slot()]), otherPublicKey)).toEqual({ ok: false, reason: "signature" });
  });

  it("rifiuta firme mancanti, rovinate o file non validi", async () => {
    const good = JSON.parse(await signedFeed([slot()]));
    expect((await verifySponsorFeed(JSON.stringify({ ...good, signature: "" }), publicKey)).ok).toBe(false);
    expect((await verifySponsorFeed(JSON.stringify({ ...good, signature: "%%%" }), publicKey)).ok).toBe(false);
    expect(await verifySponsorFeed("not json", publicKey)).toEqual({ ok: false, reason: "format" });
    expect(await verifySponsorFeed(JSON.stringify({ v: 2, payload: "", signature: "" }), publicKey)).toEqual({ ok: false, reason: "format" });
    expect((await verifySponsorFeed(await signedFeed([slot()]), "not-a-key")).ok).toBe(false);
  });

  it(`accetta al massimo ${MAX_SPONSOR_SLOTS} slot`, async () => {
    const many = Array.from({ length: MAX_SPONSOR_SLOTS + 1 }, (_, i) => slot({ id: `s-${i}` }));
    expect(await verifySponsorFeed(await signedFeed(many), publicKey)).toEqual({ ok: false, reason: "payload" });
    const ten = many.slice(0, MAX_SPONSOR_SLOTS);
    const result = await verifySponsorFeed(await signedFeed(ten), publicKey);
    expect(result.ok && result.slots.length).toBe(MAX_SPONSOR_SLOTS);
  });

  it("scarta gli slot con temi vietati, link o senza inglese, anche se firmati", async () => {
    const result = await verifySponsorFeed(
      await signedFeed([
        slot({ id: "ok" }),
        slot({ id: "body", text: { en: "Love your body." } }),
        slot({ id: "food-it", text: { en: "Keep going.", it: "Mangia meglio." } }),
        slot({ id: "link", text: { en: "Visit www.example.com today." } }),
        slot({ id: "no-en", text: { it: "Solo italiano." } }),
        slot({ id: "brand", sponsor: "Diet Co" }),
      ]),
      publicKey,
    );
    expect(result.ok && result.slots.map((s) => s.id)).toEqual(["ok"]);
    expect(result.ok && result.dropped).toBe(5);
  });

  it("rifiuta date scritte male", async () => {
    const result = await verifySponsorFeed(await signedFeed([slot({ date: "2026-13-01" })]), publicKey);
    expect(result).toEqual({ ok: false, reason: "payload" });
  });
});

describe("validità di un giorno", () => {
  const s: SponsorSlot = { id: "a", sponsor: "Acme", date: "2026-10-06", text: { en: "Keep going." } };

  it("uno slot vale solo nel suo giorno", () => {
    expect(slotsForDay([s], "2026-10-05")).toEqual([]);
    expect(slotsForDay([s], "2026-10-06")).toEqual([s]);
    expect(slotsForDay([s], "2026-10-07")).toEqual([]);
  });
});

describe("limiti di frequenza degli sponsor", () => {
  const log: SponsorLogEntry[] = [{ sponsor: "Acme", day: "2026-10-01", at: 0 }];

  it("massimo 1 notifica sponsorizzata a settimana in totale", () => {
    expect(sponsorAllowed(log, "Other", "2026-10-07")).toBe(false);
    expect(sponsorAllowed(log, "Other", "2026-10-08")).toBe(true);
    // Vale anche all'indietro (voci già programmate dopo quel giorno).
    expect(sponsorAllowed(log, "Other", "2026-09-25")).toBe(false);
  });

  it("massimo 1 al mese per lo stesso sponsor (senza distinguere maiuscole)", () => {
    expect(sponsorAllowed(log, "ACME ", "2026-10-30")).toBe(false);
    expect(sponsorAllowed(log, "Acme", "2026-10-31")).toBe(true);
  });
});

// --- Pianificazione delle notifiche ---------------------------------------------

const NOW = new Date(2026, 9, 5, 7, 0); // 5 ottobre 2026, 7:00
const TEXTS = { title: "Quote of the day", sponsoredTitle: "Sponsored · {brand}" };

const prefs = (over: Partial<QuotePreferences> = {}): QuotePreferences => ({
  ...DEFAULT_QUOTE_PREFERENCES,
  notify: true,
  ...over,
});

const optedIn = (over: Partial<QuotePreferences> = {}) =>
  prefs({ sponsored: { optIn: true, consentAt: NOW.getTime() - 1000, consentVersion: SPONSOR_CONSENT_VERSION }, ...over });

/** Uno slot al giorno per 14 giorni, da sponsor diversi. */
const dailySlots: SponsorSlot[] = Array.from({ length: 14 }, (_, i) => ({
  id: `s-${String(i).padStart(2, "0")}`,
  sponsor: `Brand ${i % 3}`,
  date: addDays("2026-10-05", i),
  text: { en: `Sponsored line ${i}.`, it: `Frase sponsor ${i}.` },
}));

function plan(p: QuotePreferences, slots: SponsorSlot[] = [], log: SponsorLogEntry[] = [], now = NOW) {
  return planNotifications({ now, prefs: p, locale: "en", quoteTexts: EN_TEXTS, texts: TEXTS, sponsorSlots: slots, sponsorLog: log });
}

describe("notifiche locali", () => {
  it("senza notifiche attive non programma nulla", () => {
    expect(plan(prefs({ notify: false })).notifications).toEqual([]);
  });

  it("una al giorno per i prossimi giorni, nell'ora scelta", () => {
    const { notifications } = plan(prefs({ times: ["08:30"] }));
    expect(notifications).toHaveLength(HORIZON_DAYS);
    expect(new Date(notifications[0].at)).toEqual(new Date(2026, 9, 5, 8, 30));
    expect(notifications.every((n) => n.channelId === CHANNEL_QUOTES && n.sponsor === null)).toBe(true);
  });

  it(`resta sotto il limite di iOS (${IOS_PENDING_LIMIT} in attesa), lasciando posto ad altri promemoria`, () => {
    const { notifications } = plan(prefs({ times: ["08:00", "13:00", "18:00"], quiet: { enabled: false, start: "22:00", end: "07:00" } }));
    expect(notifications.length).toBeLessThanOrEqual(QUOTE_NOTIFICATION_BUDGET);
    expect(QUOTE_NOTIFICATION_BUDGET).toBeLessThan(IOS_PENDING_LIMIT);
    const big = planNotifications({ now: NOW, prefs: prefs({ times: ["08:00", "13:00", "18:00"] }), locale: "en", quoteTexts: EN_TEXTS, texts: TEXTS, sponsorSlots: [], sponsorLog: [], budget: 999 });
    expect(big.notifications.length).toBeLessThanOrEqual(QUOTE_NOTIFICATION_BUDGET);
    const ids = notifications.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id >= QUOTE_ID_BASE && id <= QUOTE_ID_MAX)).toBe(true);
    // In ordine di tempo: se il limite taglia, taglia le più lontane.
    expect([...notifications].sort((a, b) => a.at - b.at)).toEqual(notifications);
  });

  it("salta gli orari già passati e quelli nelle ore di silenzio", () => {
    const { notifications } = plan(prefs({ times: ["06:30", "12:00", "23:00"] }));
    // Silenzio dalle 22 alle 7: restano solo quelle delle 12, da oggi.
    const hours = new Set(notifications.map((n) => new Date(n.at).getHours()));
    expect(hours).toEqual(new Set([12]));
    expect(notifications[0].day).toBe("2026-10-05");
    // Senza silenzio, le 6:30 di oggi sono già passate (sono le 7): la prima è domani.
    const awake = plan(prefs({ times: ["06:30"], quiet: { enabled: false, start: "22:00", end: "07:00" } })).notifications;
    expect(awake[0].day).toBe("2026-10-06");
  });

  it("la pausa ferma le notifiche fino alla fine, poi riprendono da sole", () => {
    const pausedUntil = new Date(2026, 9, 8, 0, 0).getTime();
    const { notifications } = plan(prefs({ pausedUntil }));
    expect(notifications.every((n) => n.at >= pausedUntil)).toBe(true);
    expect(notifications[0].day).toBe("2026-10-08");
  });

  it("il testo è solo la frase dell'archivio e un titolo fisso: mai dati personali", () => {
    const archive = new Set(Object.values(EN_TEXTS));
    for (const n of plan(prefs({ times: ["08:00", "18:00"] })).notifications) {
      expect(n.title).toBe(TEXTS.title);
      expect(archive.has(n.body)).toBe(true);
    }
  });

  it("la prima notifica di oggi è la frase mostrata in Oggi", () => {
    const { notifications } = plan(prefs({ intensity: "hard", times: ["08:30"] }));
    const first = QUOTES.find((q) => EN_TEXTS[q.id] === notifications[0].body)!;
    expect(first.intensity).toBe("hard");
  });
});

describe("notifiche sponsorizzate", () => {
  it("niente sponsor senza consenso esplicito, anche con slot disponibili", () => {
    const { notifications, sponsorLog } = plan(prefs(), dailySlots);
    expect(notifications.some((n) => n.sponsor !== null)).toBe(false);
    expect(sponsorLog).toEqual([]);
  });

  it("niente sponsor se il consenso è di una versione vecchia del testo", () => {
    const old = prefs({ sponsored: { optIn: true, consentAt: 1, consentVersion: SPONSOR_CONSENT_VERSION - 1 } });
    expect(plan(old, dailySlots).notifications.some((n) => n.sponsor !== null)).toBe(false);
  });

  it("con il consenso: al massimo 1 a settimana, etichettata, nel canale separato", () => {
    const { notifications, sponsorLog } = plan(optedIn(), dailySlots);
    const sponsored = notifications.filter((n) => n.sponsor !== null);
    expect(sponsored.map((n) => n.day)).toEqual(["2026-10-05", "2026-10-12"]);
    for (const n of sponsored) {
      expect(n.title).toBe(`Sponsored · ${n.sponsor}`);
      expect(n.channelId).toBe(CHANNEL_SPONSORED);
    }
    expect(sponsorLog).toHaveLength(2);
    // Prende il posto della frase del giorno: il totale non cresce.
    expect(notifications).toHaveLength(HORIZON_DAYS);
  });

  it("al massimo 1 al mese per sponsor", () => {
    const sameBrand = dailySlots.map((s) => ({ ...s, sponsor: "Acme" }));
    const sponsored = plan(optedIn(), sameBrand).notifications.filter((n) => n.sponsor !== null);
    expect(sponsored.map((n) => n.day)).toEqual(["2026-10-05"]);
  });

  it("tiene conto di quelle già arrivate (registro sul dispositivo)", () => {
    const log: SponsorLogEntry[] = [{ sponsor: "Brand 9", day: "2026-10-02", at: new Date(2026, 9, 2, 8, 30).getTime() }];
    const sponsored = plan(optedIn(), dailySlots, log).notifications.filter((n) => n.sponsor !== null);
    expect(sponsored[0].day).toBe("2026-10-09");
  });

  it("ripianificando, le voci solo programmate non contano due volte", () => {
    const first = plan(optedIn(), dailySlots);
    const again = plan(optedIn(), dailySlots, first.sponsorLog);
    expect(again.notifications).toEqual(first.notifications);
    expect(again.sponsorLog).toEqual(first.sponsorLog);
  });

  it("spegnendo il consenso le sponsorizzate programmate spariscono", () => {
    const first = plan(optedIn(), dailySlots);
    const off = plan(prefs(), dailySlots, first.sponsorLog);
    expect(off.notifications.some((n) => n.sponsor !== null)).toBe(false);
  });

  it("uno slot scaduto (giorno passato) non si usa più", () => {
    const yesterday: SponsorSlot = { id: "old", sponsor: "Acme", date: "2026-10-04", text: { en: "Keep going." } };
    expect(plan(optedIn(), [yesterday]).notifications.some((n) => n.sponsor !== null)).toBe(false);
  });

  it("niente sponsor durante la pausa o nelle ore di silenzio", () => {
    const pausedUntil = new Date(2026, 9, 20).getTime();
    expect(plan(optedIn({ pausedUntil }), dailySlots).notifications).toEqual([]);
    const onlyNight = optedIn({ times: ["23:00"] });
    expect(plan(onlyNight, dailySlots).notifications).toEqual([]);
  });

  it("usa la lingua dell'utente, con l'inglese se manca la traduzione", () => {
    const slots: SponsorSlot[] = [
      { id: "a", sponsor: "Acme", date: "2026-10-05", text: { en: "Keep going.", it: "Vai avanti." } },
    ];
    const it = planNotifications({ now: NOW, prefs: optedIn(), locale: "it", quoteTexts: IT_TEXTS, texts: TEXTS, sponsorSlots: slots, sponsorLog: [] });
    expect(it.notifications[0].body).toBe("Vai avanti.");
    const onlyEn: SponsorSlot[] = [{ id: "a", sponsor: "Acme", date: "2026-10-05", text: { en: "Keep going." } }];
    const fallback = planNotifications({ now: NOW, prefs: optedIn(), locale: "it", quoteTexts: IT_TEXTS, texts: TEXTS, sponsorSlots: onlyEn, sponsorLog: [] });
    expect(fallback.notifications[0].body).toBe("Keep going.");
  });
});
