import { type Rng, shuffle } from "@/lib/random";

// Tabella di Schulte: numeri da 1 a N² mescolati in una griglia, da toccare in
// ordine il più in fretta possibile. Allena attenzione e visione periferica.
export const SCHULTE_SIZE = 5;

export function generateSchulteGrid(rng: Rng, size: number = SCHULTE_SIZE): number[] {
  return shuffle(
    rng,
    Array.from({ length: size * size }, (_, i) => i + 1),
  );
}

/** Secondi con un decimale. */
export function schulteSeconds(ms: number): number {
  return Math.round(ms / 100) / 10;
}
