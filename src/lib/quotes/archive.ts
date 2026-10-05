import { INTENSITIES, type Intensity, QUOTE_CATEGORIES, type QuoteCategory } from "./categories";

// Archivio delle "Frasi del giorno": qui solo id, categoria e tono; i testi sono
// in texts/<lingua>.ts (uno per lingua, così il telefono carica solo la sua).
// Gli id sono <categoria><tono><numero>: d(iscipline) h(abits) c(haracter) r(ecovery);
// s(oft) d(irect) h(ard). Es. "ch07" = carattere, duro, settima frase.
//
// Personalità dell'app (decisa dal proprietario il 5/10/2026): un po' aggressiva,
// ironica, a volte sfacciata. Regole che restano (controllate da quotes.test.ts
// con content-rules.ts):
//  * solo disciplina, abitudini, carattere, recupero;
//  * mai corpo, peso, aspetto fisico, cibo, calorie, ciclo;
//  * si può punzecchiare, ma mai insultare chi legge né umiliare persone o gruppi;
//  * nessun dato personale (nome compreso): le frasi finiscono nelle notifiche;
//  * nelle lingue con il genere grammaticale, forme neutre quando si può
//    (in italiano niente "sei pronto/pronta").
//
// Aggiungere una frase: alzare il numero della sua cella qui sotto e scrivere il
// testo con il nuovo id in OGNI file di texts/ (il test segnala quelli mancanti).
// Le frasi nuove vanno in coda, così gli id esistenti non cambiano.

const COUNTS: Record<QuoteCategory, Record<Intensity, number>> = {
  discipline: { soft: 23, direct: 30, hard: 29 },
  habits: { soft: 18, direct: 22, hard: 14 },
  character: { soft: 23, direct: 31, hard: 31 },
  recovery: { soft: 32, direct: 24, hard: 14 },
};

export type Quote = { id: string; category: QuoteCategory; intensity: Intensity };

const CATEGORY_CODE: Record<QuoteCategory, string> = { discipline: "d", habits: "h", character: "c", recovery: "r" };
const INTENSITY_CODE: Record<Intensity, string> = { soft: "s", direct: "d", hard: "h" };

export const QUOTES: readonly Quote[] = QUOTE_CATEGORIES.flatMap((category) =>
  INTENSITIES.flatMap((intensity) =>
    Array.from({ length: COUNTS[category][intensity] }, (_, i): Quote => ({
      id: `${CATEGORY_CODE[category]}${INTENSITY_CODE[intensity]}${String(i + 1).padStart(2, "0")}`,
      category,
      intensity,
    })),
  ),
);
