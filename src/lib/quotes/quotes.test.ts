import { describe, expect, it } from "vitest";
import { LOCALES, type Locale } from "@/i18n/config";
import { addDays } from "@/lib/dates";
import { QUOTES } from "./archive";
import { INTENSITIES, QUOTE_CATEGORIES } from "./categories";
import { forbiddenTerms, isAllowedText } from "./content-rules";
import { quoteFor } from "./pick";
import { DEFAULT_QUOTE_PREFERENCES, inQuietHours, quotePreferencesSchema, sponsoredAllowed } from "./preferences";
import * as z from "zod/mini";
import type { QuoteTexts } from "./texts";
import { en as enTexts } from "./texts/en";
import { it as itTexts } from "./texts/it";
import { es as esTexts } from "./texts/es";
import { fr as frTexts } from "./texts/fr";
import { pt as ptTexts } from "./texts/pt";
import { de as deTexts } from "./texts/de";
import { pl as plTexts } from "./texts/pl";
import { ru as ruTexts } from "./texts/ru";
import { zh as zhTexts } from "./texts/zh";
import { ar as arTexts } from "./texts/ar";
import { he as heTexts } from "./texts/he";

// Tutte le lingue (TypeScript chiede le nuove): servono ai controlli sui testi.
const TEXTS: Record<Locale, QuoteTexts> = {
  en: enTexts,
  it: itTexts,
  es: esTexts,
  fr: frTexts,
  pt: ptTexts,
  de: deTexts,
  pl: plTexts,
  ru: ruTexts,
  zh: zhTexts,
  ar: arTexts,
  he: heTexts,
};

describe("archivio delle frasi", () => {
  it("ha almeno 150 frasi, con id unici", () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(150);
    expect(new Set(QUOTES.map((q) => q.id)).size).toBe(QUOTES.length);
  });

  it("copre ogni categoria con ogni intensità", () => {
    for (const category of QUOTE_CATEGORIES) {
      for (const intensity of INTENSITIES) {
        const n = QUOTES.filter((q) => q.category === category && q.intensity === intensity).length;
        expect(n, `${category}/${intensity}`).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it("ogni lingua ha esattamente le frasi dell'archivio, senza testi vuoti o doppioni", () => {
    const ids = QUOTES.map((q) => q.id).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(TEXTS[locale]).sort(), locale).toEqual(ids);
      const texts = Object.values(TEXTS[locale]);
      for (const t of texts) expect(t.trim().length, `${locale}: ${t}`).toBeGreaterThanOrEqual(4);
      const dup = texts.filter((t, i) => texts.indexOf(t) !== i);
      expect(dup, locale).toEqual([]);
    }
  });

  it("nessuna frase tocca temi vietati (corpo, peso, cibo, calorie, ciclo, umiliazioni)", () => {
    const offending = QUOTES.flatMap((q) =>
      LOCALES.flatMap((locale) => forbiddenTerms(TEXTS[locale][q.id] ?? "", locale).map((f) => `${q.id}/${locale}: ${f.term}`)),
    );
    expect(offending).toEqual([]);
  });

  it("le frasi sono brevi, adatte a una notifica", () => {
    for (const locale of LOCALES) {
      for (const [id, t] of Object.entries(TEXTS[locale])) expect(t.length, `${locale}/${id}`).toBeLessThanOrEqual(120);
    }
  });
});

describe("categorie vietate", () => {
  it.each([
    ["en", "Love your body and the scale will follow."],
    ["en", "Lose weight before summer!"],
    ["en", "Skip the snack, earn your dinner."],
    ["en", "Burn 500 calories today."],
    ["en", "Track your period with us."],
    ["en", "Don't be lazy."],
    ["en", "Stop acting like a girl."],
    ["it", "Ama il tuo corpo."],
    ["it", "Perdi peso entro l'estate."],
    ["it", "Mangia meno, vivi meglio."],
    ["it", "Brucia 500 calorie."],
    ["it", "Segui il tuo ciclo."],
    ["it", "Non fare il pigro."],
    ["it", "Sei un perdente."],
    ["it", "Pesarsi ogni mattina aiuta."],
    ["es", "Controla tu peso."],
    ["fr", "Arrête de manger le soir."],
    ["pt", "Fique longe do açúcar."],
    ["de", "Weniger Kalorien, mehr Erfolg."],
    ["pl", "Dbaj o swoją wagę."],
    ["ru", "Следи за своим весом каждый день."],
    ["zh", "今天少吃一点。"],
    ["zh", "别当懒鬼。"],
    ["ar", "راقب وزنك كل يوم."],
    ["ar", "قلّل السكر."],
    ["ar", "لا تكن كسولًا."],
    ["he", "לשמור על המשקל."],
    ["he", "בלי סוכר היום."],
    ["he", "אל תהיה עצלן."],
  ] as const)("%s: «%s» è vietata", (locale, text) => {
    expect(isAllowedText(text, locale)).toBe(false);
  });

  it.each([
    ["en", "Fame isn't the goal. Craft is."],
    ["en", "Repeat the work, not the excuse."],
    ["en", "Great things take time."],
    ["it", "La pigrizia si vince un passo alla volta."],
    ["it", "Una giornata pesante passa."],
    ["it", "Il grassetto non serve: scrivi chiaro."],
    ["fr", "Apprends à lâcher prise."],
    ["pl", "Jeszcze jeden krok."],
    ["ru", "Это обещание себе."],
    ["zh", "吃苦是自律的一部分。"],
    ["ar", "الرجوع إلى العادة أسهل مما تظن."],
    ["ar", "شكرًا على المحاولة."],
    ["he", "משמעת היא בחירה, לא תחושה."],
    ["he", "זמן לא מחזירים."],
  ] as const)("%s: «%s» è ammessa (niente falsi allarmi)", (locale, text) => {
    expect(isAllowedText(text, locale)).toBe(true);
  });

  it("riconosce maiuscole, accenti e spazi doppi", () => {
    expect(isAllowedText("BODY goals", "en")).toBe(false);
    expect(isAllowedText("Man   up.", "en")).toBe(false);
    expect(isAllowedText("Dimagrire è facile", "it")).toBe(false);
  });
});

describe("frase del giorno", () => {
  it("è la stessa per lo stesso giorno e intensità", () => {
    expect(quoteFor("2026-10-05", "hard").id).toBe(quoteFor("2026-10-05", "hard").id);
  });

  it("rispetta l'intensità scelta", () => {
    for (const intensity of INTENSITIES) {
      for (let d = 0; d < 30; d++) expect(quoteFor(addDays("2026-10-01", d), intensity).intensity).toBe(intensity);
    }
  });

  it("non si ripete per molti giorni e usa tutte le categorie", () => {
    const ids = Array.from({ length: 17 }, (_, d) => quoteFor(addDays("2026-10-01", d), "direct").id);
    expect(new Set(ids).size).toBe(ids.length);
    const categories = new Set(ids.map((id) => QUOTES.find((q) => q.id === id)!.category));
    expect(categories.size).toBe(QUOTE_CATEGORIES.length);
  });

  it("le notifiche dello stesso giorno hanno frasi diverse", () => {
    const ids = [0, 1, 2].map((slot) => quoteFor("2026-10-05", "soft", slot).id);
    expect(new Set(ids).size).toBe(3);
  });

  it("funziona anche per date prima dell'inizio del calendario interno", () => {
    expect(quoteFor("2020-01-01", "soft").intensity).toBe("soft");
  });
});

describe("preferenze", () => {
  it("le frasi sponsorizzate sono spente di partenza", () => {
    expect(DEFAULT_QUOTE_PREFERENCES.sponsored.optIn).toBe(false);
    expect(sponsoredAllowed(DEFAULT_QUOTE_PREFERENCES)).toBe(false);
    // Anche un salvataggio vecchio senza il campo riceve "spento".
    const parsed = z.parse(quotePreferencesSchema, {});
    expect(parsed.sponsored.optIn).toBe(false);
    expect(parsed).toEqual(DEFAULT_QUOTE_PREFERENCES);
  });

  it("il consenso vale solo se dato, con data e sul testo attuale", () => {
    const base = DEFAULT_QUOTE_PREFERENCES;
    expect(sponsoredAllowed({ ...base, sponsored: { optIn: true, consentAt: null, consentVersion: 1 } })).toBe(false);
    expect(sponsoredAllowed({ ...base, sponsored: { optIn: true, consentAt: 1, consentVersion: 0 } })).toBe(false);
    expect(sponsoredAllowed({ ...base, sponsored: { optIn: true, consentAt: 1, consentVersion: 1 } })).toBe(true);
  });

  it("ore di silenzio, anche a cavallo della mezzanotte", () => {
    const night = { enabled: true, start: "22:00", end: "07:00" };
    expect(inQuietHours("23:30", night)).toBe(true);
    expect(inQuietHours("06:59", night)).toBe(true);
    expect(inQuietHours("07:00", night)).toBe(false);
    expect(inQuietHours("12:00", night)).toBe(false);
    const lunch = { enabled: true, start: "13:00", end: "14:00" };
    expect(inQuietHours("13:30", lunch)).toBe(true);
    expect(inQuietHours("14:00", lunch)).toBe(false);
    expect(inQuietHours("23:30", { ...night, enabled: false })).toBe(false);
  });

  it("rifiuta orari scritti male o troppi orari", () => {
    expect(z.safeParse(quotePreferencesSchema, { times: ["25:00"] }).success).toBe(false);
    expect(z.safeParse(quotePreferencesSchema, { times: ["08:00", "09:00", "10:00", "11:00"] }).success).toBe(false);
    expect(z.safeParse(quotePreferencesSchema, { times: [] }).success).toBe(false);
  });
});
