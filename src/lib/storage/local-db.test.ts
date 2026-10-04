import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import * as z from "zod/mini";
import { type Backend, LEGACY_PREFIX, openIdbBackend } from "./backends";
import { ALL_DEFS, DEFS } from "./definitions";
import { createLocalDb } from "./local-db";
import { MIGRATION_META, migrateLegacy } from "./migration";

// localStorage finto (in Node non esiste).
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

// Dati come li scrive oggi l'app (stessi campi e formati), compresi i casi
// "storici": un risultato con il nome italiano del gioco della prima versione.
const LEGACY = {
  profile: { sex: "female", birthYear: 1995, birthMonth: 3, heightCm: 165, activityLevel: "moderate", goal: "maintain" },
  "body-weights": [
    { day: "2026-09-20", kg: 61.2 },
    { day: "2026-10-01", kg: 60.5 },
  ],
  "brain-results": [
    { id: "b1", game: "reazione", variant: "default", at: "2026-09-01T07:00:00.000Z", day: "2026-09-01", score: 312, metrics: { best: 280 }, routine: true },
    { id: "b2", game: "math", variant: "classic-60", at: "2026-10-04T07:05:00.000Z", day: "2026-10-04", score: 21, metrics: {}, routine: true },
  ],
  workouts: [
    { id: "w1", day: "2026-10-03", at: "2026-10-03T17:00:00.000Z", type: "running", minutes: 45, intensity: 2 },
    { id: "w2", day: "2026-10-04", at: "2026-10-04T12:00:00.000Z", type: "gym", minutes: 60, intensity: 3, note: "gambe" },
  ],
  "food-entries": [
    { id: "f1", day: "2026-10-04", at: "2026-10-04T12:30:00.000Z", meal: "lunch", name: "Pasta al pomodoro", kcal: 600, protein: 15, carbs: 80, fat: 6 },
    { id: "f2", day: "2026-10-04", at: "2026-10-04T16:00:00.000Z", meal: "snack", name: "Mela", kcal: 52 },
  ],
  "cycle-consent": { acceptedAt: "2026-09-01T10:00:00.000Z" },
  "cycle-periods": [
    { id: "p1", start: "2026-08-29", end: "2026-09-02" },
    { id: "p2", start: "2026-09-26" },
  ],
  "cycle-day-logs": [{ day: "2026-09-27", flow: "medium", symptoms: ["cramps"] }],
};

let storage: MemoryStorage;
let factory: IDBFactory;

function fillLegacy(data: Record<string, unknown> = LEGACY) {
  for (const [key, value] of Object.entries(data)) storage.setItem(LEGACY_PREFIX + key, JSON.stringify(value));
  // Impostazione del dispositivo: deve restare in localStorage.
  storage.setItem(`${LEGACY_PREFIX}appearance`, JSON.stringify({ background: "smoke", motion: 70, palettes: {} }));
}

function newDb(open: () => Promise<Backend> = () => openIdbBackend(factory)) {
  return createLocalDb({ defs: ALL_DEFS, open, legacy: storage, now: () => "2026-10-04T15:00:00.000Z" });
}

const valueOf = (db: ReturnType<typeof newDb>, name: keyof typeof DEFS) => db.store(DEFS[name] as never).get();

beforeEach(() => {
  storage = new MemoryStorage();
  factory = new IDBFactory();
});

describe("migrazione da localStorage a IndexedDB", () => {
  it("copia tutti i dati reali, verifica la copia e solo dopo cancella i vecchi", async () => {
    fillLegacy();
    const db = newDb();
    await db.start();

    expect(db.backendKind()).toBe("idb");
    expect(db.migrationReport()).toMatchObject({ status: "done", kept: [] });
    expect(valueOf(db, "profile")).toEqual(LEGACY.profile);
    expect(valueOf(db, "workouts")).toEqual(LEGACY.workouts);
    expect(valueOf(db, "foodEntries")).toEqual(LEGACY["food-entries"]);
    expect(valueOf(db, "bodyWeights")).toEqual(LEGACY["body-weights"]);
    expect(valueOf(db, "cyclePeriods")).toEqual(LEGACY["cycle-periods"]);
    expect(valueOf(db, "cycleDayLogs")).toEqual(LEGACY["cycle-day-logs"]);
    // I consensi vecchi ricevono "enabled: true" e restano senza versione: andranno ridati.
    expect(valueOf(db, "cycleConsent")).toEqual({ ...LEGACY["cycle-consent"], enabled: true });
    // Il nome storico del gioco viene convertito come faceva già l'app.
    expect((valueOf(db, "brainResults") as { game: string }[]).map((r) => r.game)).toEqual(["reaction", "math"]);

    for (const key of Object.keys(LEGACY)) expect(storage.getItem(LEGACY_PREFIX + key)).toBeNull();
    expect(storage.getItem(`${LEGACY_PREFIX}appearance`)).not.toBeNull();
  });

  it("i dati migrati sono pronti per il cloud: da inviare, con le date", async () => {
    fillLegacy();
    const db = newDb();
    await db.start();
    const [w1] = db.records("workouts");
    expect(w1).toMatchObject({ key: "w1", dirty: true, deletedAt: null, createdAt: "2026-10-04T15:00:00.000Z" });
    expect(db.dirty("workouts")).toHaveLength(2);
  });

  it("al riavvio i dati ci sono e la migrazione non si ripete", async () => {
    fillLegacy();
    await newDb().start();
    // Un vecchio valore ricomparso (es. scheda con la versione precedente) non viene più importato.
    storage.setItem(`${LEGACY_PREFIX}workouts`, JSON.stringify([]));

    const again = newDb();
    await again.start();
    expect(again.migrationReport()).toEqual({ status: "already" });
    expect(valueOf(again, "workouts")).toEqual(LEGACY.workouts);
  });

  it("un elemento rovinato non fa perdere gli altri, e la chiave vecchia resta come riserva", async () => {
    fillLegacy({ ...LEGACY, "food-entries": [...LEGACY["food-entries"], { id: "rotto", kcal: "tante" }] });
    storage.setItem(`${LEGACY_PREFIX}cycle-periods`, "{non è json");
    const db = newDb();
    await db.start();

    expect(valueOf(db, "foodEntries")).toEqual(LEGACY["food-entries"]);
    expect(db.migrationReport()).toMatchObject({ status: "done", kept: ["cycle-periods", "food-entries"] });
    expect(storage.getItem(`${LEGACY_PREFIX}food-entries`)).not.toBeNull();
    expect(storage.getItem(`${LEGACY_PREFIX}cycle-periods`)).toBe("{non è json");
  });

  it("se la copia non corrisponde, non cancella nulla e continua col vecchio salvataggio", async () => {
    fillLegacy();
    const real = await openIdbBackend(factory);
    // Disco "difettoso": rilegge i dati con un valore cambiato.
    const broken: Backend = {
      ...real,
      async loadAll() {
        return (await real.loadAll()).map((r) => (r.key === "w1" ? { ...r, value: { ...(r.value as object), minutes: 1 } } : r));
      },
    };
    const db = newDb(async () => broken);
    await db.start();

    expect(db.migrationReport()).toMatchObject({ status: "failed" });
    expect(db.backendKind()).toBe("legacy");
    expect(storage.getItem(`${LEGACY_PREFIX}workouts`)).toBe(JSON.stringify(LEGACY.workouts));
    expect(valueOf(db, "workouts")).toEqual(LEGACY.workouts);
    expect(await real.getMeta(MIGRATION_META)).toBeUndefined();
  });

  it("senza IndexedDB l'app funziona come prima con localStorage", async () => {
    fillLegacy();
    const db = newDb(() => Promise.reject(new Error("IndexedDB non disponibile")));
    await db.start();
    expect(db.backendKind()).toBe("legacy");

    const workouts = db.store(DEFS.workouts);
    workouts.set((prev) => prev.filter((w) => w.id !== "w1"));
    await db.flush();
    expect(JSON.parse(storage.getItem(`${LEGACY_PREFIX}workouts`)!)).toEqual([LEGACY.workouts[1]]);
  });

  it("migrazione senza dati vecchi: niente da fare, ma si segna come fatta", async () => {
    const backend = await openIdbBackend(factory);
    expect(await migrateLegacy(backend, storage, ALL_DEFS, "t")).toEqual({ status: "nothing" });
    expect(await backend.getMeta(MIGRATION_META)).toMatchObject({ done: true });
  });
});

describe("archivio locale", () => {
  it("modifiche e cancellazioni morbide, salvate su disco", async () => {
    const db = newDb();
    await db.start();
    const workouts = db.store(DEFS.workouts);
    workouts.set(LEGACY.workouts as never);
    workouts.set((prev) => prev.filter((w) => w.id !== "w1"));
    await db.flush();

    expect(workouts.get()).toEqual([LEGACY.workouts[1]]);
    const tomb = db.records("workouts").find((r) => r.key === "w1")!;
    expect(tomb).toMatchObject({ value: null, dirty: true });
    expect(tomb.deletedAt).not.toBeNull();

    // Una nuova istanza (riapertura dell'app) legge lo stesso stato dal disco.
    const reopened = newDb();
    await reopened.start();
    expect(reopened.store(DEFS.workouts).get()).toEqual([LEGACY.workouts[1]]);
    expect(reopened.records("workouts")).toHaveLength(2);
  });

  it("niente scritture se il valore non cambia", async () => {
    const db = newDb();
    await db.start();
    const profile = db.store(DEFS.profile);
    profile.set({ sex: "male" });
    const before = db.records("profile")[0].updatedAt;
    profile.set({ sex: "male" });
    expect(db.records("profile")[0].updatedAt).toBe(before);
    expect(db.records("profile")).toHaveLength(1);
  });

  it("le scritture prima del caricamento si applicano dopo, senza perdere i dati esistenti", async () => {
    fillLegacy();
    const db = newDb();
    const workouts = db.store(DEFS.workouts);
    workouts.set((prev) => [...prev, { id: "w3", day: "2026-10-04", at: "2026-10-04T18:00:00.000Z", type: "yoga", minutes: 20, intensity: 1 }]);
    await db.start();
    expect(workouts.get().map((w) => w.id)).toEqual(["w1", "w2", "w3"]);
  });

  it("cancellazione totale del ciclo: non resta nessun record", async () => {
    fillLegacy();
    const db = newDb();
    await db.start();
    db.store(DEFS.cyclePeriods).purge();
    db.store(DEFS.cycleDayLogs).purge();
    await db.flush();

    const reopened = newDb();
    await reopened.start();
    expect(reopened.records("cycle-periods")).toEqual([]);
    expect(reopened.records("cycle-day-logs")).toEqual([]);
  });

  it("i dati solo-dispositivo si cancellano davvero e non vanno in coda", async () => {
    const deviceOnly = { kind: "doc", name: "solo-qui", schema: z.nullable(z.string()), fallback: null, sync: false } as const;
    const db = createLocalDb({ defs: [...ALL_DEFS, deviceOnly], open: () => openIdbBackend(factory), legacy: null });
    await db.start();
    const store = db.store(deviceOnly);
    store.set("valore");
    expect(db.dirty("solo-qui")).toEqual([]);
    store.clear();
    expect(db.records("solo-qui")).toEqual([]);
  });

  it("un salvataggio fallito si segnala, e l'avviso sparisce al primo salvataggio riuscito", async () => {
    let full = false;
    const db = newDb(async () => {
      const real = await openIdbBackend(factory);
      return { ...real, write: (puts, deletes) => (full ? Promise.reject(new Error("spazio pieno")) : real.write(puts, deletes)) };
    });
    await db.start();
    let calls = 0;
    db.onWriteError(() => calls++);
    const weights = db.store(DEFS.bodyWeights);

    full = true;
    weights.set([{ day: "2026-10-04", kg: 70 }]);
    await db.flush();
    expect(db.lastWriteError()).toBeInstanceOf(Error);
    expect(calls).toBe(1);

    full = false;
    weights.set([{ day: "2026-10-04", kg: 71 }]);
    await db.flush();
    expect(db.lastWriteError()).toBeNull();
    expect(calls).toBe(2);
  });
});
