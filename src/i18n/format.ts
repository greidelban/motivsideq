import type { Locale } from "./config";

type Vars = Record<string, string | number>;

/** Sostituisce i segnaposto {nome} con i valori. */
export function interpolate(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

// Forme plurali secondo le regole CLDR della lingua (Intl.PluralRules):
// l'inglese e l'italiano usano "one"/"other", altre lingue anche "few", "many"...
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export function plural(locale: Locale, n: number, forms: PluralForms, vars: Vars = {}): string {
  const rule = new Intl.PluralRules(locale).select(n);
  return interpolate(forms[rule] ?? forms.other, { n: formatNumber(locale, n), ...vars });
}

export function formatNumber(locale: Locale, n: number, digits = 0): string {
  return n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Durata leggibile: "850 ms" sotto il secondo, "1.4 s" (o "1,4 s") sopra. */
export function formatDuration(locale: Locale, ms: number): string {
  if (ms < 1000) return `${formatNumber(locale, Math.round(ms))} ms`;
  return `${formatNumber(locale, ms / 1000, 1)} s`;
}

export function formatPercent(locale: Locale, fraction: number): string {
  return Math.abs(fraction).toLocaleString(locale, { style: "percent", maximumFractionDigits: 0 });
}
