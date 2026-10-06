import type { Locale } from "@/i18n/config";
import type { FoodNames } from "../catalog";

// I nomi degli alimenti di ogni lingua stanno in un file a parte, caricato solo
// quando serve (come le frasi del giorno). Il test controlla che ogni lingua
// abbia tutti gli alimenti della tabella.
const LOADERS: Record<Locale, () => Promise<FoodNames>> = {
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

const cache = new Map<Locale, FoodNames>();

export async function loadFoodNames(locale: Locale): Promise<FoodNames> {
  const cached = cache.get(locale);
  if (cached) return cached;
  const names = await LOADERS[locale]();
  cache.set(locale, names);
  return names;
}

export function cachedFoodNames(locale: Locale): FoodNames | null {
  return cache.get(locale) ?? null;
}
