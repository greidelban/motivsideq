import { type Backend, LEGACY_PREFIX, normalize, valueFromLegacy } from "./backends";
import { type Def, recordsFromValue, valueFromRecords } from "./records";

// Passaggio una tantum dal vecchio localStorage a IndexedDB.
// Regola: i vecchi dati si cancellano SOLO dopo aver riletto la copia e
// verificato che sia identica. Un valore con elementi non validi si copia per
// la parte buona ma la chiave vecchia resta (copia di riserva).

export const MIGRATION_META = "legacy-migration";

export type MigrationReport =
  | { status: "already" | "nothing" }
  | { status: "done"; migrated: string[]; kept: string[] }
  | { status: "failed"; reason: string };

export async function migrateLegacy(backend: Backend, storage: Storage, defs: readonly Def[], now: string): Promise<MigrationReport> {
  if ((await backend.getMeta(MIGRATION_META))?.done) return { status: "already" };

  const copies: { def: Def; value: unknown; complete: boolean }[] = [];
  const unreadable: string[] = [];
  for (const def of defs) {
    let raw: string | null;
    try {
      raw = storage.getItem(LEGACY_PREFIX + def.name);
    } catch {
      return { status: "failed", reason: "localStorage non leggibile" };
    }
    if (raw === null) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      unreadable.push(def.name);
      continue;
    }
    const value = valueFromLegacy(def, parsed);
    if (value === undefined) {
      unreadable.push(def.name);
      continue;
    }
    const complete = def.kind === "doc" || (value as unknown[]).length === (parsed as unknown[]).length;
    copies.push({ def, value, complete });
  }

  if (copies.length === 0) {
    await backend.setMeta(MIGRATION_META, { done: true, at: now, keys: [] });
    return { status: "nothing" };
  }

  try {
    await backend.write(
      copies.flatMap((c) => recordsFromValue(c.def, c.value, now)),
      [],
    );
  } catch (error) {
    return { status: "failed", reason: `scrittura: ${String(error)}` };
  }

  // Verifica: si rilegge dal disco e si confronta con l'originale.
  const reread = normalize(await backend.loadAll());
  for (const { def, value } of copies) {
    const copy = valueFromRecords(def, reread.filter((r) => r.collection === def.name));
    if (JSON.stringify(copy) !== JSON.stringify(value)) {
      return { status: "failed", reason: `verifica non riuscita per ${def.name}` };
    }
  }

  const migrated = copies.map((c) => c.def.name);
  await backend.setMeta(MIGRATION_META, { done: true, at: now, keys: migrated });
  const kept = [...unreadable];
  for (const { def, complete } of copies) {
    if (!complete) {
      kept.push(def.name);
      continue;
    }
    try {
      storage.removeItem(LEGACY_PREFIX + def.name);
    } catch {
      kept.push(def.name);
    }
  }
  return { status: "done", migrated, kept };
}
