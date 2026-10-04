import type { z } from "zod";

// Dati locali "pronti al cloud": ogni elemento è un record con i metadati di
// sincronizzazione (stessi campi delle tabelle in supabase/migrations/).
// Qui c'è solo logica pura, senza browser: si prova con Vitest.

/** Elenco di elementi con una chiave (id o giorno). */
export type ListDef<T> = {
  kind: "list";
  name: string;
  item: z.ZodType<T>;
  keyOf(item: T): string;
  /** false = dato solo di questo dispositivo, mai inviato al cloud. */
  sync: boolean;
};

/** Un solo valore (profilo, consenso...). */
export type DocDef<T> = {
  kind: "doc";
  name: string;
  schema: z.ZodType<T>;
  fallback: T;
  sync: boolean;
};

// keyOf è scritto come metodo: così ListDef<Allenamento> vale anche come ListDef<unknown>.
export type Def = ListDef<unknown> | DocDef<unknown>;

export type StoredRecord = {
  collection: string;
  key: string;
  /** null nei record cancellati: del contenuto non resta nulla. */
  value: unknown;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** Modificato qui e non ancora inviato al cloud. */
  dirty: boolean;
  /** Ordine di inserimento, per ricostruire l'elenco come era. */
  pos: number;
};

export const DOC_KEY = "doc";

export type Changes = { puts: StoredRecord[]; deletes: string[] };

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Ricostruisce il valore per l'app: solo record vivi e validi, nell'ordine salvato. */
export function valueFromRecords(def: Def, records: Iterable<StoredRecord>): unknown {
  const live = [...records].filter((r) => r.deletedAt === null);
  if (def.kind === "doc") {
    const parsed = live.length ? def.schema.safeParse(live[0].value) : null;
    return parsed?.success ? parsed.data : def.fallback;
  }
  const out: unknown[] = [];
  for (const r of live.sort((a, b) => a.pos - b.pos)) {
    const parsed = def.item.safeParse(r.value);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/** Record nuovi per un valore intero (migrazione, import iniziale). */
export function recordsFromValue(def: Def, value: unknown, now: string): StoredRecord[] {
  const base = { collection: def.name, createdAt: now, updatedAt: now, deletedAt: null, dirty: def.sync };
  if (def.kind === "doc") return [{ ...base, key: DOC_KEY, value, pos: 0 }];
  return (value as unknown[]).map((item, pos) => ({ ...base, key: def.keyOf(item), value: item, pos }));
}

/**
 * Confronta il valore nuovo con i record attuali e restituisce solo ciò che è
 * cambiato: elementi nuovi o modificati (updatedAt = ora, da inviare), elementi
 * spariti (cancellazione morbida se si sincronizzano, vera altrimenti).
 */
export function diffValue(def: Def, current: ReadonlyMap<string, StoredRecord>, next: unknown, now: string): Changes {
  const changes: Changes = { puts: [], deletes: [] };
  let maxPos = -1;
  for (const r of current.values()) maxPos = Math.max(maxPos, r.pos);

  const upsert = (key: string, value: unknown) => {
    const existing = current.get(key);
    if (existing && existing.deletedAt === null && same(existing.value, value)) return;
    changes.puts.push({
      collection: def.name,
      key,
      value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
      dirty: def.sync,
      pos: existing?.pos ?? ++maxPos,
    });
  };

  const remove = (record: StoredRecord) => {
    if (def.sync) {
      changes.puts.push({ ...record, value: null, updatedAt: now, deletedAt: now, dirty: true });
    } else {
      changes.deletes.push(record.key);
    }
  };

  if (def.kind === "doc") {
    const existing = current.get(DOC_KEY);
    if (next === null || next === undefined) {
      if (existing && existing.deletedAt === null) remove(existing);
    } else {
      upsert(DOC_KEY, next);
    }
    return changes;
  }

  const keep = new Set<string>();
  for (const item of next as unknown[]) {
    const key = def.keyOf(item);
    keep.add(key);
    upsert(key, item);
  }
  for (const r of current.values()) {
    if (r.deletedAt === null && !keep.has(r.key)) remove(r);
  }
  return changes;
}
