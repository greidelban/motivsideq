import { daysBetween } from "@/lib/dates";
import { seededRng, shuffle } from "@/lib/random";
import { QUOTES, type Quote } from "./archive";
import type { Intensity } from "./categories";
import { MAX_TIMES_PER_DAY } from "./preferences";

// Scelta della frase: deterministica (stesso giorno e intensità = stessa frase,
// sulla scheda di Oggi come nella prima notifica), senza nulla di casuale da salvare.
// L'ordine è mescolato una volta per intensità, così le categorie si alternano;
// lo stesso testo torna solo dopo aver usato tutte le frasi di quell'intensità.

const EPOCH = "2026-01-01";
const ORDER = new Map<Intensity, readonly Quote[]>();

function orderFor(intensity: Intensity): readonly Quote[] {
  let order = ORDER.get(intensity);
  if (!order) {
    const seed = [...intensity].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7);
    order = shuffle(
      seededRng(seed),
      QUOTES.filter((q) => q.intensity === intensity),
    );
    ORDER.set(intensity, order);
  }
  return order;
}

/** Frase del giorno `day` ("AAAA-MM-GG"); `slot` è la notifica del giorno (0 = la frase di Oggi). */
export function quoteFor(day: string, intensity: Intensity, slot = 0): Quote {
  const order = orderFor(intensity);
  const n = order.length;
  const index = daysBetween(EPOCH, day) * MAX_TIMES_PER_DAY + slot;
  return order[((index % n) + n) % n];
}
