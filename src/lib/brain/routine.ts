import type { GameId } from "./games";

// Ordine pensato per il risveglio: si parte dal più semplice (reagire a uno
// stimolo), poi attenzione selettiva, calcolo e ricerca visiva. ~4 minuti.
export const ROUTINE_STEPS: readonly GameId[] = ["reaction", "colors", "math", "schulte"];
