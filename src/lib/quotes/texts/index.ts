import type { Locale } from "@/i18n/config";
import type { QuoteTexts } from "./types";

export type { QuoteTexts };

// Ogni lingua è un file a parte, caricato solo quando serve: il telefono non
// scarica le frasi di tutte le lingue. Una lingua nuova va aggiunta qui
// (TypeScript lo chiede) e il test controlla che abbia tutte le frasi.
const LOADERS: Record<Locale, () => Promise<QuoteTexts>> = {
  en: () => import("./en").then((m) => m.en),
  it: () => import("./it").then((m) => m.it),
  es: () => import("./es").then((m) => m.es),
  fr: () => import("./fr").then((m) => m.fr),
  pt: () => import("./pt").then((m) => m.pt),
  de: () => import("./de").then((m) => m.de),
  pl: () => import("./pl").then((m) => m.pl),
  ru: () => import("./ru").then((m) => m.ru),
  zh: () => import("./zh").then((m) => m.zh),
  ar: () => import("./ar").then((m) => m.ar),
  he: () => import("./he").then((m) => m.he),
};

const cache = new Map<Locale, QuoteTexts>();

export async function loadQuoteTexts(locale: Locale): Promise<QuoteTexts> {
  const cached = cache.get(locale);
  if (cached) return cached;
  const texts = await LOADERS[locale]();
  cache.set(locale, texts);
  return texts;
}

/** Già caricati (null altrimenti): evita uno sfarfallio quando si torna su una pagina. */
export function cachedQuoteTexts(locale: Locale): QuoteTexts | null {
  return cache.get(locale) ?? null;
}
