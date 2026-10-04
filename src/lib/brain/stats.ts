export type Better = "higher" | "lower";

export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export const MIN_HISTORY_FOR_COMPARISON = 3;

export type Comparison = {
  /** Mediana dei risultati precedenti considerati. */
  baseline: number;
  /** Miglioramento rispetto alla mediana: +0.06 = 6% meglio del solito, negativo = peggio. */
  improvement: number;
};

/**
 * Confronta un risultato con i propri precedenti (gli ultimi `window`).
 * Serve un minimo di storico, altrimenti il confronto non dice nulla.
 */
export function compareToBaseline(
  previous: readonly number[],
  value: number,
  better: Better,
  { minHistory = MIN_HISTORY_FOR_COMPARISON, window = 10 }: { minHistory?: number; window?: number } = {},
): Comparison | null {
  if (previous.length < minHistory) return null;
  const baseline = median(previous.slice(-window));
  if (!Number.isFinite(baseline) || baseline === 0) return null;
  const raw = (value - baseline) / baseline;
  return { baseline, improvement: better === "higher" ? raw : -raw };
}

/** Nuovo record personale? (Mai al primo tentativo: senza storico non è un record.) */
export function isPersonalBest(previous: readonly number[], value: number, better: Better): boolean {
  if (previous.length === 0) return false;
  return better === "higher" ? value > Math.max(...previous) : value < Math.min(...previous);
}

export function bestOf(values: readonly number[], better: Better): number | null {
  if (values.length === 0) return null;
  return better === "higher" ? Math.max(...values) : Math.min(...values);
}
