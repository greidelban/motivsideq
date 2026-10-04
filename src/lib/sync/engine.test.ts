import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { openIdbBackend } from "@/lib/storage/backends";
import { ALL_DEFS, DEFS } from "@/lib/storage/definitions";
import { createLocalDb } from "@/lib/storage/local-db";
import { type Remote, RemoteError, type SyncState, syncOnce } from "./engine";
import { type Row, SYNC_TABLES } from "./tables";

// Finto server con le stesse regole del database (supabase/migrations/):
// vince l'updated_at più recente, ogni scrittura riceve un server_updated_at
// crescente, limite giornaliero sulle righe nuove, pulizia delle cancellate.
class FakeServer implements Remote {
  tables = new Map<string, Map<string, Row>>();
  private tick = 0;
  /** Righe nuove ancora ammesse oggi (null = nessun limite). */
  allowance: number | null = null;
  /** Fallisce la chiamata n-esima di upsert (simula la rete che cade a metà). */
  failUpsertAt: number | null = null;
  private upserts = 0;

  private table(name: string) {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name)!;
  }

  private stamp() {
    this.tick++;
    return new Date(Date.UTC(2026, 9, 4, 12, 0, 0, this.tick)).toISOString();
  }

  private keyOf(table: string, row: Record<string, unknown>) {
    return String(table === "body_weights" ? row.measured_on : row.id);
  }

  async upsert(table: string, rows: Record<string, unknown>[]) {
    this.upserts++;
    if (this.failUpsertAt === this.upserts) throw new RemoteError("network", "rete assente");
    const t = this.table(table);
    const fresh = rows.filter((r) => !t.has(this.keyOf(table, r))).length;
    if (this.allowance !== null) {
      if (fresh > this.allowance) throw new RemoteError("limit", "RL001");
      this.allowance -= fresh;
    }
    for (const r of rows) {
      const key = this.keyOf(table, r);
      const old = t.get(key);
      if (old && old.updated_at > (r.updated_at as string)) continue;
      t.set(key, { ...(old ?? {}), ...r, created_at: old?.created_at ?? (r.created_at as string), server_updated_at: this.stamp() } as Row);
    }
  }

  async markDeleted(table: string, _keyColumn: string, key: string, deletedAt: string, updatedAt: string) {
    const t = this.table(table);
    const old = t.get(key);
    if (!old || old.updated_at > updatedAt) return;
    t.set(key, { ...old, deleted_at: deletedAt, updated_at: updatedAt, server_updated_at: this.stamp() });
  }

  async pullSince(table: string, since: string | null, limit: number) {
    return [...this.table(table).values()]
      .filter((r) => since === null || r.server_updated_at! > since)
      .sort((a, b) => a.server_updated_at!.localeCompare(b.server_updated_at!))
      .slice(0, limit);
  }

  /** Pulizia mensile: le righe cancellate da più di 180 giorni spariscono. */
  purgeDeleted() {
    for (const t of this.tables.values()) for (const [k, r] of t) if (r.deleted_at) t.delete(k);
  }

  live(table: string) {
    return [...this.table(table).values()].filter((r) => !r.deleted_at);
  }
}

let clock = Date.UTC(2026, 9, 4, 10, 0, 0);
const nowIso = () => new Date(++clock).toISOString();

async function phone() {
  const db = createLocalDb({ defs: ALL_DEFS, open: () => openIdbBackend(new IDBFactory()), legacy: null, now: nowIso });
  await db.start();
  return {
    db,
    weights: db.store(DEFS.bodyWeights),
    workouts: db.store(DEFS.workouts),
    brain: db.store(DEFS.brainResults),
    state: null as SyncState | null,
  };
}

async function sync(p: Awaited<ReturnType<typeof phone>>, server: Remote, now = new Date(clock)) {
  const report = await syncOnce({ db: p.db, remote: server, tables: SYNC_TABLES, state: p.state, userId: "user-1", now });
  p.state = report.state;
  return report;
}

const workout = (id: string, minutes = 30) => ({ id, day: "2026-10-04", at: "2026-10-04T09:00:00.000Z", type: "running" as const, minutes, intensity: 2 as const });

describe("sincronizzazione", () => {
  it("primo accesso: carica i dati del telefono senza doppioni, anche ripetendo", async () => {
    const server = new FakeServer();
    const p = await phone();
    p.weights.set([{ day: "2026-10-01", kg: 70 }, { day: "2026-10-02", kg: 69.8 }]);
    p.workouts.set([workout("w1"), workout("w2")]);
    p.brain.set([{ id: "b1", game: "reaction", variant: "default", at: "2026-10-04T07:00:00.000Z", day: "2026-10-04", score: 300, metrics: { best: 280 }, routine: true }]);

    expect(await sync(p, server)).toMatchObject({ outcome: "synced", pushed: 5 });
    expect(await sync(p, server)).toMatchObject({ outcome: "synced", pushed: 0 });
    expect(server.live("body_weights")).toHaveLength(2);
    expect(server.live("workout_sessions")).toHaveLength(2);
    expect(server.live("brain_results")).toHaveLength(1);
    expect(p.db.dirty("workouts")).toEqual([]);
    // I valori tornano identici dal cloud.
    const fresh = await phone();
    await sync(fresh, server);
    expect(fresh.workouts.get()).toEqual(p.workouts.get());
    expect(fresh.weights.get()).toEqual(p.weights.get());
    expect(fresh.brain.get()).toEqual(p.brain.get());
  });

  it("due telefoni: vince la modifica più recente, le cancellazioni arrivano ovunque", async () => {
    const server = new FakeServer();
    const a = await phone();
    const b = await phone();
    a.weights.set([{ day: "2026-10-04", kg: 70 }]);
    a.workouts.set([workout("w1")]);
    await sync(a, server);
    await sync(b, server);
    expect(b.workouts.get()).toHaveLength(1);

    // B corregge il peso più tardi e cancella l'allenamento.
    b.weights.set([{ day: "2026-10-04", kg: 69.5 }]);
    b.workouts.set([]);
    await sync(b, server);
    await sync(a, server);
    expect(a.weights.get()).toEqual([{ day: "2026-10-04", kg: 69.5 }]);
    expect(a.workouts.get()).toEqual([]);
  });

  it("una modifica locale più recente non viene sovrascritta dal download", async () => {
    const server = new FakeServer();
    const a = await phone();
    const b = await phone();
    a.weights.set([{ day: "2026-10-04", kg: 70 }]);
    await sync(a, server);
    await sync(b, server);
    b.weights.set([{ day: "2026-10-04", kg: 71 }]); // modifica vecchia, non ancora inviata
    a.weights.set([{ day: "2026-10-04", kg: 72 }]); // modifica più nuova
    await sync(a, server);
    await sync(b, server);
    await sync(a, server);
    expect(a.weights.get()[0].kg).toBe(72);
    expect(b.weights.get()[0].kg).toBe(72);
  });

  it("la rete cade a metà invio: al nuovo tentativo riparte senza doppioni né perdite", async () => {
    const server = new FakeServer();
    const p = await phone();
    p.workouts.set(Array.from({ length: 450 }, (_, i) => workout(`w${i}`)));
    server.failUpsertAt = 2; // primo blocco ok, il secondo fallisce
    expect(await sync(p, server)).toMatchObject({ outcome: "offline", pushed: 200 });
    expect(p.db.dirty("workouts")).toHaveLength(250);

    server.failUpsertAt = null;
    expect(await sync(p, server)).toMatchObject({ outcome: "synced", pushed: 250 });
    expect(server.live("workout_sessions")).toHaveLength(450);
  });

  it("limite giornaliero: i dati restano in coda e partono il giorno dopo", async () => {
    const server = new FakeServer();
    const p = await phone();
    p.workouts.set([workout("w1"), workout("w2"), workout("w3")]);
    server.allowance = 1;
    expect((await sync(p, server)).outcome).toBe("limit");
    expect(p.db.dirty("workouts")).toHaveLength(3);
    expect(p.workouts.get()).toHaveLength(3);

    server.allowance = null; // il giorno dopo
    expect((await sync(p, server)).outcome).toBe("synced");
    expect(server.live("workout_sessions")).toHaveLength(3);
  });

  it("modifica fatta durante l'invio: resta in coda per il giro dopo", async () => {
    const server = new FakeServer();
    const p = await phone();
    p.workouts.set([workout("w1", 30)]);
    const original = server.upsert.bind(server);
    server.upsert = async (...args) => {
      await original(...args);
      p.workouts.set([workout("w1", 45)]); // l'utente modifica mentre l'invio è in volo
    };
    await sync(p, server);
    expect(p.db.dirty("workouts")).toHaveLength(1);
    server.upsert = original;
    await sync(p, server);
    expect(server.live("workout_sessions")[0].duration_min).toBe(45);
  });

  it("offline per più di 180 giorni: prima invia tutto, poi riscarica e toglie ciò che il cloud ha ripulito", async () => {
    const server = new FakeServer();
    const a = await phone();
    const b = await phone();
    a.workouts.set([workout("vecchio"), workout("tenuto")]);
    await sync(a, server, new Date(Date.UTC(2026, 0, 1)));
    await sync(b, server, new Date(Date.UTC(2026, 0, 1)));

    // B cancella "vecchio"; mesi dopo il cloud ripulisce la riga cancellata.
    b.workouts.set((prev) => prev.filter((w) => w.id !== "vecchio"));
    await sync(b, server, new Date(Date.UTC(2026, 0, 2)));
    server.purgeDeleted();

    // A, offline da allora, nel frattempo ha registrato un allenamento nuovo.
    a.workouts.set((prev) => [...prev, workout("nuovo")]);
    const report = await sync(a, server, new Date(Date.UTC(2026, 9, 1)));
    expect(report).toMatchObject({ outcome: "synced", fullResync: true, pushed: 1 });
    expect(a.workouts.get().map((w) => w.id).sort()).toEqual(["nuovo", "tenuto"]);
    expect(server.live("workout_sessions").map((r) => r.id).sort()).toEqual(["nuovo", "tenuto"]);
  });

  it("un telefono legato a un altro account non mischia i dati", async () => {
    const server = new FakeServer();
    const p = await phone();
    p.workouts.set([workout("w1")]);
    const report = await syncOnce({
      db: p.db,
      remote: server,
      tables: SYNC_TABLES,
      state: { userId: "altro", cursors: {}, lastPullAt: null },
      userId: "user-1",
    });
    expect(report.outcome).toBe("otherAccount");
    expect(server.live("workout_sessions")).toEqual([]);
  });
});

describe("cambio di account sullo stesso telefono", () => {
  it("dopo \"aggiungi i dati a questo account\" tutto riparte verso il nuovo account", async () => {
    const vecchio = new FakeServer();
    const nuovo = new FakeServer();
    const p = await phone();
    p.workouts.set([workout("w1"), workout("w2")]);
    p.workouts.set((prev) => prev.filter((w) => w.id !== "w2")); // una cancellazione
    await sync(p, vecchio);
    expect(p.db.dirty("workouts")).toEqual([]);

    // Come adoptLocalData(): tutto torna da inviare, stato azzerato.
    p.db.markAllDirty("workouts");
    p.state = null;
    expect((await sync(p, nuovo)).outcome).toBe("synced");
    expect(nuovo.live("workout_sessions").map((r) => r.id)).toEqual(["w1"]);
    expect(p.workouts.get().map((w) => w.id)).toEqual(["w1"]);
  });
});
