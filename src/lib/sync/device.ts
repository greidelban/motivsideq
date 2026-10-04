import type { LocalDb } from "@/lib/storage/local-db";
import type { Def } from "@/lib/storage/records";

// Quanto andrebbe perso togliendo i dati da questo dispositivo ("esci e togli
// i dati"): ciò che non è (ancora) nel cloud.

/**
 * Elementi che esistono solo su questo dispositivo. Negli elenchi sincronizzati
 * sono le modifiche non ancora inviate (cancellazioni comprese, altrimenti nel
 * cloud resterebbe ciò che l'utente ha tolto); negli altri tutto ciò che c'è.
 * Quando si sincronizzerà il ciclo, i campi che restano solo sul telefono
 * (rapporti, protezione, pillola) andranno contati qui anche nelle righe inviate.
 */
export function deviceOnlyCount(db: LocalDb, defs: readonly Def[], synced: ReadonlySet<string>): number {
  let n = 0;
  for (const def of defs) {
    const records = db.records(def.name);
    n += synced.has(def.name)
      ? records.filter((r) => r.dirty).length
      : records.filter((r) => r.deletedAt === null && r.value !== null && r.value !== undefined).length;
  }
  return n;
}
