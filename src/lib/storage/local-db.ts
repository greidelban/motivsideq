import { useSyncExternalStore } from "react";
import { z } from "zod";
import { type Backend, legacyBackend, normalize } from "./backends";
import type { LocalStore } from "./local-store";
import { type MigrationReport, migrateLegacy } from "./migration";
import { type Def, type DocDef, type ListDef, type StoredRecord, diffValue, valueFromRecords } from "./records";

// Archivio locale: i record stanno in memoria (letture immediate, come prima)
// e ogni modifica si salva in IndexedDB in coda. Gli store dell'app hanno la
// stessa forma di prima (get / set / use / clear), così le schermate non cambiano.

type Channel = Pick<BroadcastChannel, "postMessage"> & { onmessage: ((e: MessageEvent) => void) | null };

export type LocalDbOptions = {
  defs: readonly Def[];
  open: () => Promise<Backend>;
  /** Vecchio localStorage: sorgente della migrazione e riserva se IndexedDB manca. */
  legacy: Storage | null;
  now?: () => string;
  /** Avvisa le altre schede aperte quando qualcosa cambia. */
  channel?: Channel | null;
};

export type LocalDb = ReturnType<typeof createLocalDb>;

export function createLocalDb({ defs, open, legacy, now = () => new Date().toISOString(), channel = null }: LocalDbOptions) {
  const records = new Map<string, Map<string, StoredRecord>>(defs.map((d) => [d.name, new Map()]));
  const values = new Map<string, unknown>();
  const listeners = new Map<string, Set<() => void>>();
  const readyListeners = new Set<() => void>();
  const deferred: (() => void)[] = [];
  let ready = false;
  let backend: Backend | null = null;
  let starting: Promise<void> | null = null;
  let queue: Promise<void> = Promise.resolve();
  let migration: MigrationReport | null = null;
  let writeError: unknown = null;

  const defByName = new Map(defs.map((d) => [d.name, d]));

  function rebuild(name: string) {
    values.set(name, valueFromRecords(defByName.get(name)!, records.get(name)!.values()));
  }

  function notify(name: string) {
    listeners.get(name)?.forEach((l) => l());
  }

  function persist(task: (b: Backend) => Promise<void>, name: string) {
    queue = queue
      .then(() => task(backend!))
      .then(() => channel?.postMessage({ names: [name] }))
      .catch((error) => {
        writeError = error;
        console.error("[local-db] salvataggio non riuscito", error);
      });
  }

  async function reload(name: string) {
    if (!backend || !defByName.has(name)) return;
    const fresh = normalize(await backend.loadCollection(name));
    records.set(name, new Map(fresh.map((r) => [r.key, r])));
    rebuild(name);
    notify(name);
  }

  function start(): Promise<void> {
    starting ??= (async () => {
      let b: Backend;
      try {
        b = await open();
        if (legacy) {
          migration = await migrateLegacy(b, legacy, defs, now());
          // Copia non verificata: per questa volta si resta sul vecchio salvataggio (riprova al prossimo avvio).
          if (migration.status === "failed") b = legacyBackend(legacy, defs, now);
        }
      } catch (error) {
        console.warn("[local-db] IndexedDB non disponibile, uso localStorage", error);
        if (!legacy) throw error;
        b = legacyBackend(legacy, defs, now);
      }
      backend = b;
      for (const r of normalize(await b.loadAll())) records.get(r.collection)?.set(r.key, r);
      defs.forEach((d) => rebuild(d.name));
      ready = true;
      if (channel) channel.onmessage = (e) => (e.data?.names as string[] | undefined)?.forEach((n) => void reload(n));
      readyListeners.forEach((l) => l());
      defs.forEach((d) => notify(d.name));
      deferred.splice(0).forEach((fn) => fn());
    })();
    return starting;
  }

  function getValue(def: WithFallback): unknown {
    return ready ? values.get(def.name) : def.fallbackValue;
  }

  function setValue(def: Def, next: unknown) {
    if (!ready) {
      // Prima del caricamento non si conosce il valore attuale: si applica dopo.
      deferred.push(() => setValue(def, next));
      void start();
      return;
    }
    const prev = values.get(def.name);
    const value = typeof next === "function" ? (next as (p: unknown) => unknown)(prev) : next;
    const current = records.get(def.name)!;
    const { puts, deletes } = diffValue(def, current, value, now());
    if (puts.length === 0 && deletes.length === 0) return;
    for (const r of puts) current.set(r.key, r);
    for (const k of deletes) current.delete(k);
    rebuild(def.name);
    notify(def.name);
    persist(
      (b) =>
        b.write(
          puts,
          deletes.map((key) => ({ collection: def.name, key })),
        ),
      def.name,
    );
  }

  /** Cancella davvero (anche i segnali di cancellazione): solo per i dati del ciclo. */
  function purge(def: Def) {
    if (!ready) {
      deferred.push(() => purge(def));
      void start();
      return;
    }
    records.set(def.name, new Map());
    rebuild(def.name);
    notify(def.name);
    persist((b) => b.purge(def.name), def.name);
  }

  function subscribe(name: string, cb: () => void) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name)!.add(cb);
    return () => listeners.get(name)!.delete(cb);
  }

  function subscribeReady(cb: () => void) {
    readyListeners.add(cb);
    return () => readyListeners.delete(cb);
  }

  function store<T>(def: ListDef<T>): LocalStore<T[]> & { purge(): void };
  function store<T>(def: DocDef<T>): LocalStore<T> & { purge(): void };
  function store(input: Def): LocalStore<unknown> & { purge(): void } {
    const def = withFallback(input);
    const get = () => getValue(def);
    const sub = (cb: () => void) => subscribe(def.name, cb);
    return {
      key: def.name,
      schema: def.kind === "list" ? z.array(def.item) : def.schema,
      get,
      set: (next: unknown) => setValue(def, next),
      clear: () => setValue(def, def.kind === "list" ? [] : null),
      purge: () => purge(def),
      use: () => useSyncExternalStore(sub, get, () => def.fallbackValue),
    };
  }

  return {
    start,
    store,
    isReady: () => ready,
    subscribeReady,
    /** Attende che le scritture in coda siano su disco (test, prima di uscire). */
    flush: () => queue,
    /** Record modificati e non ancora inviati al cloud (per la sincronizzazione). */
    dirty: (name: string) => [...(records.get(name)?.values() ?? [])].filter((r) => r.dirty),
    records: (name: string) => [...(records.get(name)?.values() ?? [])],
    migrationReport: () => migration,
    backendKind: () => backend?.kind ?? null,
    lastWriteError: () => writeError,
  };
}

// Valore iniziale stabile (useSyncExternalStore vuole sempre lo stesso oggetto).
type WithFallback = Def & { fallbackValue: unknown };
const fallbacks = new WeakMap<object, WithFallback>();
function withFallback(def: Def): WithFallback {
  if (!fallbacks.has(def)) fallbacks.set(def, { ...def, fallbackValue: def.kind === "list" ? [] : def.fallback } as WithFallback);
  return fallbacks.get(def)!;
}

/** Vero quando i dati locali sono caricati. */
export function useLocalDbReady(db: LocalDb): boolean {
  return useSyncExternalStore(db.subscribeReady, db.isReady, () => false);
}
