"use client";

import { type ReactNode, createContext, useContext } from "react";
import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries";

type I18n = { locale: Locale; dict: Dictionary };

const I18nContext = createContext<I18n | null>(null);

// Il layout radice passa solo il dizionario della lingua attiva.
export function I18nProvider({ locale, dict, children }: I18n & { children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, dict }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n va usato dentro <I18nProvider>");
  return ctx;
}
