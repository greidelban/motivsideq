"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { FoodNames } from "./catalog";
import { cachedFoodNames, loadFoodNames } from "./names";

/** Nomi degli alimenti nella lingua dell'app (null finché il file non è caricato). */
export function useFoodNames(locale: Locale): FoodNames | null {
  const [loaded, setLoaded] = useState<{ locale: Locale; names: FoodNames } | null>(null);
  useEffect(() => {
    if (cachedFoodNames(locale)) return;
    let cancelled = false;
    loadFoodNames(locale).then((names) => {
      if (!cancelled) setLoaded({ locale, names });
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);
  return cachedFoodNames(locale) ?? (loaded?.locale === locale ? loaded.names : null);
}
