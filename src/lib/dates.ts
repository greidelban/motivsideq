/** Data locale in formato AAAA-MM-GG (fuso del dispositivo). */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return localDateKey(new Date(y, m - 1, d + days));
}

/** Giorni da `from` a `to` (negativo se `to` viene prima). */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  // UTC: nessun salto per l'ora legale.
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/**
 * Giorni consecutivi con almeno un'attività. Se oggi non c'è ancora nulla la
 * serie resta valida fino a ieri (la giornata non è finita).
 */
export function streak(dayKeys: Iterable<string>, today: string = localDateKey()): number {
  const days = new Set(dayKeys);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (days.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export type PartOfDay = "morning" | "afternoon" | "evening";

/** Fascia della giornata per il saluto (la notte conta come sera). */
export function partOfDay(date: Date = new Date()): PartOfDay {
  const h = date.getHours();
  if (h >= 5 && h < 13) return "morning";
  if (h >= 13 && h < 18) return "afternoon";
  return "evening";
}
