"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { cachedQuoteTexts, loadQuoteTexts, type QuoteTexts } from "./texts";

/** Testi delle frasi nella lingua dell'app (null finché il file non è caricato). */
export function useQuoteTexts(locale: Locale): QuoteTexts | null {
  const [loaded, setLoaded] = useState<{ locale: Locale; texts: QuoteTexts } | null>(null);
  useEffect(() => {
    if (cachedQuoteTexts(locale)) return;
    let cancelled = false;
    loadQuoteTexts(locale).then((texts) => {
      if (!cancelled) setLoaded({ locale, texts });
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);
  return cachedQuoteTexts(locale) ?? (loaded?.locale === locale ? loaded.texts : null);
}
