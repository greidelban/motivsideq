import { type Def, type StoredRecord, recordsFromValue, valueFromRecords } from "./records";

// Dove finiscono i record. IndexedDB è quello normale; se il browser non lo
// permette, si resta al vecchio salvataggio in localStorage (come prima).

export type MetaValue = { done: true; at: string; keys: string[] };

export interface Backend {
  readonly kind: "idb" | "legacy";
  loadAll(): Promise<StoredRecord[]>;
  loadCollection(name: string): Promise<StoredRecord[]>;
  /** Scrive in un'unica transazione: o tutto o niente. */
  write(puts: readonly StoredRecord[], deletes: readonly { collection: string; key: string }[]): Promise<void>;
  /** Cancella davvero tutti i record di un elenco (es. dati del ciclo). */
  purge(name: string): Promise<void>;
  getMeta(id: string): Promise<MetaValue | undefined>;
  setMeta(id: string, value: MetaValue): Promise<void>;
}

const DB_NAME = "ritmo";
const DB_VERSION = 1;
const RECORDS = "records";
const META = "meta";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transazione annullata"));
  });
}

export async function openIdbBackend(factory: IDBFactory = indexedDB): Promise<Backend> {
  const open = factory.open(DB_NAME, DB_VERSION);
  open.onupgradeneeded = () => {
    const db = open.result;
    // Un solo archivio per tutti i dati: un modulo nuovo non richiede di cambiare versione.
    const records = db.createObjectStore(RECORDS, { keyPath: ["collection", "key"] });
    records.createIndex("collection", "collection");
    records.createIndex("dirty", ["collection", "dirty"]);
    db.createObjectStore(META, { keyPath: "id" });
  };
  const db = await request(open);

  return {
    kind: "idb",
    async loadAll() {
      return request(db.transaction(RECORDS).objectStore(RECORDS).getAll() as IDBRequest<StoredRecord[]>);
    },
    async loadCollection(name) {
      const index = db.transaction(RECORDS).objectStore(RECORDS).index("collection");
      return request(index.getAll(name) as IDBRequest<StoredRecord[]>);
    },
    async write(puts, deletes) {
      const tx = db.transaction(RECORDS, "readwrite");
      const store = tx.objectStore(RECORDS);
      // I booleani non si indicizzano: dirty si salva come 0/1.
      for (const r of puts) store.put({ ...r, dirty: r.dirty ? 1 : 0 });
      for (const d of deletes) store.delete([d.collection, d.key]);
      await done(tx);
    },
    async purge(name) {
      const tx = db.transaction(RECORDS, "readwrite");
      const store = tx.objectStore(RECORDS);
      const keys = await request(store.index("collection").getAllKeys(name));
      for (const key of keys) store.delete(key);
      await done(tx);
    },
    async getMeta(id) {
      const row = await request(db.transaction(META).objectStore(META).get(id) as IDBRequest<({ id: string } & MetaValue) | undefined>);
      if (!row) return undefined;
      const { done, at, keys } = row;
      return { done, at, keys };
    },
    async setMeta(id, value) {
      const tx = db.transaction(META, "readwrite");
      tx.objectStore(META).put({ id, ...value });
      await done(tx);
    },
  };
}

export const LEGACY_PREFIX = "ritmo:v1:";

/**
 * Riserva: il vecchio formato in localStorage (un valore intero per chiave),
 * usato solo se IndexedDB non si apre. Tiene i record in memoria e a ogni
 * scrittura salva il valore ricostruito, come faceva l'app prima.
 */
export function legacyBackend(storage: Storage, defs: readonly Def[], now: () => string): Backend {
  const mirror = new Map<string, Map<string, StoredRecord>>();
  const byName = new Map(defs.map((d) => [d.name, d]));

  const read = (def: Def): StoredRecord[] => {
    let raw: string | null = null;
    try {
      raw = storage.getItem(LEGACY_PREFIX + def.name);
    } catch {
      return [];
    }
    if (raw === null) return [];
    try {
      const value = valueFromLegacy(def, JSON.parse(raw));
      return value === undefined ? [] : recordsFromValue(def, value, now());
    } catch {
      return [];
    }
  };

  const save = (name: string) => {
    const def = byName.get(name);
    if (!def) return;
    const value = valueFromRecords(def, mirror.get(name)?.values() ?? []);
    try {
      if (value === null) storage.removeItem(LEGACY_PREFIX + name);
      else storage.setItem(LEGACY_PREFIX + name, JSON.stringify(value));
    } catch {
      // Memoria piena o accesso negato: il dato resta solo in pagina.
    }
  };

  return {
    kind: "legacy",
    async loadAll() {
      const all: StoredRecord[] = [];
      for (const def of defs) {
        const records = read(def);
        mirror.set(def.name, new Map(records.map((r) => [r.key, r])));
        all.push(...records);
      }
      return all;
    },
    async loadCollection(name) {
      const def = byName.get(name);
      return def ? read(def) : [];
    },
    async write(puts, deletes) {
      const touched = new Set<string>();
      for (const r of puts) {
        if (!mirror.has(r.collection)) mirror.set(r.collection, new Map());
        mirror.get(r.collection)!.set(r.key, r);
        touched.add(r.collection);
      }
      for (const d of deletes) {
        mirror.get(d.collection)?.delete(d.key);
        touched.add(d.collection);
      }
      touched.forEach(save);
    },
    async purge(name) {
      mirror.delete(name);
      try {
        storage.removeItem(LEGACY_PREFIX + name);
      } catch {
        // niente da fare
      }
    },
    async getMeta() {
      return undefined;
    },
    async setMeta() {},
  };
}

/**
 * Legge un valore del vecchio formato. Gli elenchi si validano elemento per
 * elemento: uno rovinato non fa perdere gli altri. undefined = illeggibile.
 */
export function valueFromLegacy(def: Def, raw: unknown): unknown {
  if (def.kind === "doc") {
    const parsed = def.schema.safeParse(raw);
    return parsed.success ? parsed.data : undefined;
  }
  if (!Array.isArray(raw)) return undefined;
  return raw.flatMap((item) => {
    const parsed = def.item.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Record letti da IndexedDB: dirty torna booleano. */
export function normalize(records: StoredRecord[]): StoredRecord[] {
  return records.map((r) => ({ ...r, dirty: Boolean(r.dirty) }));
}
