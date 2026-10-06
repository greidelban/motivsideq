import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { type VaultCipher, newDataKey, vaultCipher } from "@/lib/crypto/vault";
import { openIdbBackend } from "@/lib/storage/backends";
import { ALL_DEFS, DEFS, SYNCED_COLLECTIONS } from "@/lib/storage/definitions";
import { createLocalDb } from "@/lib/storage/local-db";
import { type Remote, RemoteError, type SyncState, type VaultRow, syncOnce } from "./engine";

// Finto server con le stesse regole del database (supabase/migrations/):
// vince l'updated_at più recente, ogni scrittura riceve un server_updated_at
// crescente, limite giornaliero sulle righe nuove, chiave controllata, pulizia
// delle cancellate.
class FakeServer implements Remote {
  rows = new Map<string, VaultRow>();
  private tick = 0;
  /** Impronta della chiave attuale dell'account (null = qualsiasi). */
  keyId: string | null = null;
  /** Righe nuove ancora ammesse oggi (null = nessun limite). */
  allowance: number | null = null;
  /** Fallisce la chiamata n-esima di upsert (simula la rete che cade a metà). */
  failUpsertAt: number | null = null;
  private upserts = 0;

  private stamp() {
    this.tick++;
    return new Date(Date.UTC(2026, 9, 4, 12, 0, 0, this.tick)).toISOString();
  }

  async upsert(rows: VaultRow[]) {
    this.upserts++;
    if (this.failUpsertAt === this.upserts) throw new RemoteError("network", "rete assente");
    if (this.keyId && rows.some((r) => r.key_id !== this.keyId)) throw new RemoteError("key", "KY001");
    const fresh = rows.filter((r) => !this.rows.has(r.id)).length;
    if (this.allowance !== null) {
      if (fresh > this.allowance) throw new RemoteError("limit", "RL001");
      this.allowance -= fresh;
    }
    for (const r of rows) {
      const old = this.rows.get(r.id);
      if (old && old.updated_at > r.updated_at) continue;
      this.rows.set(r.id, { ...r, server_updated_at: this.stamp() });
    }
  }

  async pullSince(since: string | null, limit: number) {
    return [...this.rows.values()]
      .filter((r) => since === null || r.server_updated_at! > since)
      .sort((a, b) => a.server_updated_at!.localeCompare(b.server_updated_at!))
      .slice(0, limit);
  }

  /** Pulizia mensile: le righe cancellate da più di 180 giorni spariscono. */
  purgeDeleted() {
    for (const [k, r] of this.rows) if (r.deleted_at) this.rows.delete(k);
  }

  live() {
    return [...this.rows.values()].filter((r) => !r.deleted_at);
  }
}

let clock = Date.UTC(2026, 9, 4, 10, 0, 0);
const nowIso = () => new Date(++clock).toISOString();

async function phone(cipher: VaultCipher) {
  const db = createLocalDb({ defs: ALL_DEFS, open: () => openIdbBackend(new IDBFactory()), legacy: null, now: nowIso });
  await db.start();
  return {
    db,
    cipher,
    weights: db.store(DEFS.bodyWeights),
    workouts: db.store(DEFS.workouts),
    brain: db.store(DEFS.brainResults),
    profile: db.store(DEFS.profile),
    cycle: db.store(DEFS.cycleDayLogs),
    state: null as SyncState | null,
  };
}

async function sync(p: Awaited<ReturnType<typeof phone>>, server: Remote, now = new Date(clock)) {
  const report = await syncOnce({ db: p.db, remote: server, cipher: p.cipher, collections: SYNCED_COLLECTIONS, state: p.state, userId: "user-1", now });
  p.state = report.state;
  return report;
}

const workout = (id: string, minutes = 30) => ({ id, day: "2026-10-04", at: "2026-10-04T09:00:00.000Z", type: "running" as const, minutes, intensity: 2 as const });

describe("sincronizzazione cifrata", () => {
  it("primo accesso: carica tutto senza doppioni; il server non vede nulla di leggibile", async () => {
    const server = new FakeServer();
    const p = await phone(await vaultCipher(newDataKey()));
    p.weights.set([{ day: "2026-10-01", kg: 70 }, { day: "2026-10-02", kg: 69.8 }]);
    p.workouts.set([workout("w1"), workout("w2")]);
    p.brain.set([{ id: "b1", game: "reaction", variant: "default", at: "2026-10-04T07:00:00.000Z", day: "2026-10-04", score: 300, metrics: { best: 280 }, routine: true }]);
    p.profile.set({ displayName: "Loki", sex: "female", birthYear: 1995, birthMonth: 3 });
    p.cycle.set([{ day: "2026-10-03", flow: "medium", symptoms: ["cramps"] }]);

    expect(await sync(p, server)).toMatchObject({ outcome: "synced", pushed: 7 });
    expect(await sync(p, server)).toMatchObject({ outcome: "synced", pushed: 0 });
    expect(server.live()).toHaveLength(7);
    // Nessuna traccia dei dati, dei tipi di dato o dei giorni sul server.
    const visible = JSON.stringify([...server.rows.values()]);
    for (const word of ["Loki", "female", "running", "cramps", "medium", "body-weights", "cycle", "2026-10-01", "69.8", "reaction"]) {
      expect(visible, word).not.toContain(word);
    }

    // Un secondo telefono con la stessa chiave ritrova tutto identico.
    const fresh = await phone(p.cipher);
    await sync(fresh, server);
    expect(fresh.workouts.get()).toEqual(p.workouts.get());
    expect(fresh.weights.get()).toEqual(p.weights.get());
    expect(fresh.brain.get()).toEqual(p.brain.get());
    expect(fresh.profile.get()).toEqual(p.profile.get());
    expect(fresh.cycle.get()).toEqual(p.cycle.get());
  });

  it("senza la chiave giusta i dati del cloud restano illeggibili", async () => {
    const server = new FakeServer();
    const p = await phone(await vaultCipher(newDataKey()));
    p.workouts.set([workout("w1")]);
    await sync(p, server);
    const stranger = await phone(await vaultCipher(newDataKey()));
    const report = await sync(stranger, server);
    expect(report).toMatchObject({ outcome: "synced", unreadable: 1, pulled: 0 });
    expect(stranger.workouts.get()).toEqual([]);
  });

  it("due telefoni: vince la modifica più recente, le cancellazioni arrivano ovunque", async () => {
    const server = new FakeServer();
    const cipher = await vaultCipher(newDataKey());
    const a = await phone(cipher);
    const b = await phone(cipher);
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

  it("chi gestisce il server non può cancellare né far ricomparire elementi cambiando deleted_at", async () => {
    const server = new FakeServer();
    const cipher = await vaultCipher(newDataKey());
    const a = await phone(cipher);
    a.workouts.set([workout("w1"), workout("w2")]);
    await sync(a, server);
    a.workouts.set([workout("w1")]); // w2 cancellato davvero
    await sync(a, server);
    // Il server segna w1 come cancellato e toglie il segnale da w2 (stesso testo cifrato).
    for (const row of server.rows.values()) {
      row.deleted_at = row.deleted_at ? null : "2026-10-04T12:00:00.000Z";
      row.updated_at = "2026-10-05T00:00:00.000Z";
    }
    const b = await phone(cipher);
    await sync(b, server);
    expect(b.workouts.get()).toEqual([workout("w1")]);
  });

  it("cancellare i dati del ciclo arriva al cloud e all'altro telefono, e non lascia tracce", async () => {
    const server = new FakeServer();
    const cipher = await vaultCipher(newDataKey());
    const a = await phone(cipher);
    const b = await phone(cipher);
    a.cycle.set([{ day: "2026-10-03", flow: "medium", symptoms: ["cramps"] }, { day: "2026-10-04", flow: "light", symptoms: [] }]);
    await sync(a, server);
    await sync(b, server);
    expect(b.cycle.get()).toHaveLength(2);

    // Come deleteCycleData() con il cloud: cancellazioni normali, senza valori.
    a.cycle.clear();
    await sync(a, server);
    await sync(b, server);
    expect(b.cycle.get()).toEqual([]);
    // Nel cloud restano solo segnali vuoti; sui telefoni nemmeno quelli.
    for (const row of server.rows.values()) {
      const content = await cipher.open(row.id, row.payload);
      if (content.c === "cycle-day-logs") expect([row.deleted_at !== null, content.v]).toEqual([true, null]);
    }
    expect(a.db.records("cycle-day-logs")).toEqual([]);
    expect(b.db.records("cycle-day-logs")).toEqual([]);

    // Un telefono nuovo non li vede ricomparire.
    const fresh = await phone(cipher);
    await sync(fresh, server);
    expect(fresh.cycle.get()).toEqual([]);
  });

  it("una modifica locale più recente non viene sovrascritta dal download", async () => {
    const server = new FakeServer();
    const cipher = await vaultCipher(newDataKey());
    const a = await phone(cipher);
    const b = await phone(cipher);
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
    const p = await phone(await vaultCipher(newDataKey()));
    p.workouts.set(Array.from({ length: 450 }, (_, i) => workout(`w${i}`)));
    server.failUpsertAt = 2; // primo blocco ok, il secondo fallisce
    expect(await sync(p, server)).toMatchObject({ outcome: "offline", pushed: 200 });
    expect(p.db.dirty("workouts")).toHaveLength(250);

    server.failUpsertAt = null;
    expect(await sync(p, server)).toMatchObject({ outcome: "synced", pushed: 250 });
    expect(server.live()).toHaveLength(450);
  });

  it("limite giornaliero: i dati restano in coda e partono il giorno dopo", async () => {
    const server = new FakeServer();
    const p = await phone(await vaultCipher(newDataKey()));
    p.workouts.set([workout("w1"), workout("w2"), workout("w3")]);
    server.allowance = 1;
    expect((await sync(p, server)).outcome).toBe("limit");
    expect(p.db.dirty("workouts")).toHaveLength(3);
    expect(p.workouts.get()).toHaveLength(3);

    server.allowance = null; // il giorno dopo
    expect((await sync(p, server)).outcome).toBe("synced");
    expect(server.live()).toHaveLength(3);
  });

  it("chiave non più valida (caveau ricreato altrove): niente invii, serve il codice", async () => {
    const server = new FakeServer();
    const p = await phone(await vaultCipher(newDataKey()));
    server.keyId = "un-altra-chiave";
    p.workouts.set([workout("w1")]);
    expect((await sync(p, server)).outcome).toBe("key");
    expect(p.db.dirty("workouts")).toHaveLength(1);
    expect(server.rows.size).toBe(0);
  });

  it("modifica fatta durante l'invio: resta in coda per il giro dopo", async () => {
    const server = new FakeServer();
    const p = await phone(await vaultCipher(newDataKey()));
    p.workouts.set([workout("w1", 30)]);
    const original = server.upsert.bind(server);
    server.upsert = async (rows) => {
      await original(rows);
      p.workouts.set([workout("w1", 45)]); // l'utente modifica mentre l'invio è in volo
    };
    await sync(p, server);
    expect(p.db.dirty("workouts")).toHaveLength(1);
    server.upsert = original;
    await sync(p, server);
    const other = await phone(p.cipher);
    await sync(other, server);
    expect(other.workouts.get()[0].minutes).toBe(45);
  });

  it("offline per più di 180 giorni: prima invia tutto, poi riscarica e toglie ciò che il cloud ha ripulito", async () => {
    const server = new FakeServer();
    const cipher = await vaultCipher(newDataKey());
    const a = await phone(cipher);
    const b = await phone(cipher);
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
    expect(server.live()).toHaveLength(2);
  });

  it("un telefono legato a un altro account o a un'altra chiave non mischia i dati", async () => {
    const server = new FakeServer();
    const p = await phone(await vaultCipher(newDataKey()));
    p.workouts.set([workout("w1")]);
    const base = { db: p.db, remote: server, cipher: p.cipher, collections: SYNCED_COLLECTIONS, userId: "user-1" };
    expect((await syncOnce({ ...base, state: { userId: "altro", keyId: p.cipher.keyId, cursor: null, lastPullAt: null } })).outcome).toBe("otherAccount");
    expect((await syncOnce({ ...base, state: { userId: "user-1", keyId: "vecchia", cursor: null, lastPullAt: null } })).outcome).toBe("otherAccount");
    expect(server.rows.size).toBe(0);
  });
});

describe("cambio di account sullo stesso telefono", () => {
  it("dopo \"aggiungi i dati a questo account\" tutto riparte verso il nuovo caveau", async () => {
    const vecchio = new FakeServer();
    const nuovo = new FakeServer();
    const p = await phone(await vaultCipher(newDataKey()));
    p.workouts.set([workout("w1"), workout("w2")]);
    p.workouts.set((prev) => prev.filter((w) => w.id !== "w2")); // una cancellazione
    await sync(p, vecchio);
    expect(p.db.dirty("workouts")).toEqual([]);

    // Come runOnce() con uno stato azzerato: tutto torna da inviare, con la chiave del nuovo account.
    for (const c of SYNCED_COLLECTIONS) p.db.markAllDirty(c);
    p.state = null;
    p.cipher = await vaultCipher(newDataKey());
    expect((await sync(p, nuovo)).outcome).toBe("synced");
    expect(nuovo.live()).toHaveLength(1);
    expect(p.workouts.get().map((w) => w.id)).toEqual(["w1"]);
  });
});
