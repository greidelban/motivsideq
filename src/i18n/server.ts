import { cache } from "react";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, type Locale, isLocale, matchLocale } from "./config";
import { DICTIONARIES } from "./dictionaries";

// Lingua della richiesta: quella scelta in Impostazioni (cookie), altrimenti
// quella del browser, altrimenti l'inglese.
export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return matchLocale((await headers()).get("accept-language"));
});

export async function getI18n() {
  const locale = await getLocale();
  return { locale, dict: DICTIONARIES[locale] };
}
