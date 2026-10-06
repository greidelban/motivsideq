import { type CatalogFood, FOODS } from "./foods";

// Ricerca nella tabella degli alimenti e calcolo dei valori per una quantità.
// Logica pura: i nomi nella lingua dell'app arrivano da names/<lingua>.ts.

/** Nomi in una lingua: id → "Nome|sinonimo|sinonimo" (i sinonimi servono solo alla ricerca). */
export type FoodNames = Readonly<Record<string, string>>;

/** Quantità massima di una voce (g o ml): oltre è quasi certamente un errore di battitura. */
const MAX_AMOUNT = 5000;

export function foodName(names: FoodNames, id: string): string | undefined {
  return names[id]?.split("|")[0];
}

// Minuscole e senza accenti, come la ricerca nel Diario.
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

export type SearchOptions = {
  /** false per i minorenni: niente bevande alcoliche. */
  alcohol: boolean;
  limit?: number;
};

/**
 * Alimenti che corrispondono alla ricerca, i più pertinenti prima:
 * nome che inizia con il testo, poi una parola che inizia con il testo, poi il
 * testo in mezzo; a parità, il nome più corto ("Mela" prima di "Melanzana").
 */
export function searchFoods(names: FoodNames, query: string, { alcohol, limit = 8 }: SearchOptions): CatalogFood[] {
  const q = fold(query.trim());
  if (q === "") return [];
  const scored: { food: CatalogFood; score: number; length: number }[] = [];
  for (const food of FOODS) {
    if (!alcohol && food.alcohol) continue;
    const variants = (names[food.id] ?? "").split("|").filter(Boolean).map(fold);
    let best = Infinity;
    for (const [i, v] of variants.entries()) {
      // Il nome vero vale un po' più dei sinonimi.
      const extra = i === 0 ? 0 : 0.5;
      if (v.startsWith(q)) best = Math.min(best, 0 + extra);
      else if (v.split(/[\s\-'’(),/]+/).some((w) => w.startsWith(q))) best = Math.min(best, 1 + extra);
      else if (v.includes(q)) best = Math.min(best, 2 + extra);
    }
    if (best < Infinity) scored.push({ food, score: best, length: variants[0]?.length ?? 0 });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.length - b.length)
    .slice(0, limit)
    .map((s) => s.food);
}

export type Nutrients = { kcal: number; protein: number; carbs: number; fat: number };

const oneDecimal = (n: number) => Math.round(n * 10) / 10;

/** Valori per una quantità in grammi (o ml): kcal intere, macro con un decimale. */
export function nutrientsFor(food: CatalogFood, amount: number): Nutrients {
  const k = amount / 100;
  return {
    kcal: Math.round(food.kcal * k),
    protein: oneDecimal(food.protein * k),
    carbs: oneDecimal(food.carbs * k),
    fat: oneDecimal(food.fat * k),
  };
}

export const isValidAmount = (amount: number) => Number.isFinite(amount) && amount > 0 && amount <= MAX_AMOUNT;
