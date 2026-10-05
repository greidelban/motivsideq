import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { plural } from "@/i18n/format";
import type { CycleStatus } from "@/lib/health/cycle";

/** "Prossime mestruazioni tra 3 giorni" / "previste oggi" / "2 giorni di ritardo". */
export function nextPeriodLabel(locale: Locale, dict: Dictionary, status: CycleStatus): string {
  const t = dict.health.cycle.status;
  if (status.daysUntilNext > 0) return plural(locale, status.daysUntilNext, t.nextIn);
  if (status.daysUntilNext === 0) return t.nextToday;
  return plural(locale, -status.daysUntilNext, t.late);
}
