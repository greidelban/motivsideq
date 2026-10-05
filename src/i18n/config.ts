// Lingue supportate. L'inglese è la lingua base: definisce le chiavi dei
// dizionari e si usa quando la lingua del browser non è disponibile.
// Per aggiungere una lingua: un nuovo file in ./dictionaries, il codice qui
// sotto e il nome in LOCALE_NAMES. TypeScript segnala le traduzioni mancanti.
export const LOCALES = ["en", "it", "es", "fr", "pt", "de", "pl", "ru", "zh", "ar", "he"] as const;
export type Locale = (typeof LOCALES)[number];

const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "ritmo-locale";

// Nome di ogni lingua scritto nella lingua stessa (come nei selettori di sistema).
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  it: "Italiano",
  es: "Español",
  fr: "Français",
  pt: "Português",
  de: "Deutsch",
  pl: "Polski",
  ru: "Русский",
  zh: "中文",
  ar: "العربية",
  he: "עברית",
};

/** Lingue scritte da destra a sinistra: la pagina usa dir="rtl" e le classi logiche (ps/pe, start/end). */
const RTL_LOCALES: readonly Locale[] = ["ar", "he"];

export function localeDir(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Sceglie la lingua dall'header Accept-Language (es. "it-IT,it;q=0.9,en;q=0.8"):
 * la prima, in ordine di preferenza, di cui abbiamo una traduzione.
 */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const quality = q ? Number(q.slice(2)) : 1;
      return { lang: tag.trim().toLowerCase().split("-")[0], quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((x) => x.lang && x.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return ranked.map((x) => x.lang).find(isLocale) ?? DEFAULT_LOCALE;
}
