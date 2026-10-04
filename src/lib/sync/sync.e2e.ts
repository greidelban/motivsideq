import { execSync } from "node:child_process";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { IDBFactory } from "fake-indexeddb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openIdbBackend } from "@/lib/storage/backends";
import { ALL_DEFS, DEFS } from "@/lib/storage/definitions";
import { createLocalDb } from "@/lib/storage/local-db";
import { type SyncState, syncOnce } from "./engine";
import { supabaseRemote } from "./supabase-remote";
import { SYNC_TABLES } from "./tables";

// Prova completa contro Supabase SUL PC (npm run db:local): account finti,
// RLS vera, PostgREST vero, migrazioni vere. Non tocca mai il progetto online.
// Si lancia con: npm run test:e2e

type Local = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };

function localStack(): Local {
  const out = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const s = JSON.parse(out) as Local;
  // Sicurezza: solo un Supabase locale, mai quello online.
  const host = new URL(s.API_URL).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error(`Non è un Supabase locale: ${host}`);
  return s;
}

const PASSWORD = "prova-locale-1234";
let local: Local;
let admin: SupabaseClient;
const users: { id: string; email: string }[] = [];

async function newUser(name: string) {
  const email = `${name}-${Date.now()}@getcontrol.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  users.push({ id: data.user.id, email });
  return { id: data.user.id, email };
}

/** Un "telefono": archivio locale suo, sessione sua. */
async function phone(email: string) {
  const client = createClient(local.API_URL, local.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  const db = createLocalDb({ defs: ALL_DEFS, open: () => openIdbBackend(new IDBFactory()), legacy: null });
  await db.start();
  let state: SyncState | null = null;
  return {
    client,
    userId: data.user.id,
    db,
    weights: db.store(DEFS.bodyWeights),
    workouts: db.store(DEFS.workouts),
    brain: db.store(DEFS.brainResults),
    async sync() {
      const report = await syncOnce({ db, remote: supabaseRemote(client), tables: SYNC_TABLES, state, userId: data.user.id });
      state = report.state;
      await db.flush();
      return report;
    },
  };
}

const count = async (table: string, userId: string) => {
  const { count: n, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null);
  if (error) throw error;
  return n ?? 0;
};

const workout = (minutes = 30) => ({
  id: crypto.randomUUID(),
  day: "2026-10-04",
  at: new Date().toISOString(),
  type: "running" as const,
  minutes,
  intensity: 2 as const,
});

beforeAll(() => {
  local = localStack();
  admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
});

afterAll(async () => {
  // Gli account finti si cancellano (i dati spariscono a cascata).
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
});

describe("sincronizzazione con Supabase vero (locale)", () => {
  it("primo accesso: i dati del telefono arrivano tutti, una volta sola", async () => {
    const u = await newUser("primo");
    const a = await phone(u.email);
    a.weights.set([{ day: "2026-10-01", kg: 70 }, { day: "2026-10-02", kg: 69.6 }]);
    a.workouts.set([workout(), workout(45)]);
    a.brain.set([{ id: crypto.randomUUID(), game: "math", variant: "classic-60", at: new Date().toISOString(), day: "2026-10-04", score: 21, metrics: { avgMs: 2400 }, routine: true }]);

    expect(await a.sync()).toMatchObject({ outcome: "synced", pushed: 5 });
    expect(await a.sync()).toMatchObject({ outcome: "synced", pushed: 0 });
    expect(await count("body_weights", u.id)).toBe(2);
    expect(await count("workout_sessions", u.id)).toBe(2);
    expect(await count("brain_results", u.id)).toBe(1);
  });

  it("secondo telefono: scarica tutto uguale, modifiche e cancellazioni arrivano all'altro", async () => {
    const u = await newUser("due-telefoni");
    const a = await phone(u.email);
    const b = await phone(u.email);
    a.weights.set([{ day: "2026-10-04", kg: 70 }]);
    a.workouts.set([workout(30)]);
    await a.sync();

    await b.sync();
    expect(b.workouts.get()).toEqual(a.workouts.get());
    expect(b.weights.get()).toEqual(a.weights.get());

    b.weights.set([{ day: "2026-10-04", kg: 69.4 }]);
    b.workouts.set([]);
    await b.sync();
    await a.sync();
    expect(a.weights.get()).toEqual([{ day: "2026-10-04", kg: 69.4 }]);
    expect(a.workouts.get()).toEqual([]);
    expect(await count("workout_sessions", u.id)).toBe(0);
  });

  it("vince la modifica più recente anche se arriva per seconda", async () => {
    const u = await newUser("conflitto");
    const a = await phone(u.email);
    const b = await phone(u.email);
    a.weights.set([{ day: "2026-10-04", kg: 70 }]);
    await a.sync();
    await b.sync();
    b.weights.set([{ day: "2026-10-04", kg: 71 }]); // più vecchia
    await new Promise((r) => setTimeout(r, 5));
    a.weights.set([{ day: "2026-10-04", kg: 72 }]); // più nuova
    await a.sync();
    await b.sync(); // invia la sua (vecchia): il database la ignora, poi scarica la nuova
    expect(b.weights.get()[0].kg).toBe(72);
    const { data } = await admin.from("body_weights").select("weight_kg").eq("user_id", u.id).single();
    expect(Number(data!.weight_kg)).toBe(72);
  });

  it("un account non vede e non tocca i dati di un altro", async () => {
    const u1 = await newUser("uno");
    const u2 = await newUser("due");
    const a = await phone(u1.email);
    const w = workout();
    a.workouts.set([w]);
    await a.sync();

    const intruder = await phone(u2.email);
    await intruder.sync();
    expect(intruder.workouts.get()).toEqual([]);
    // Prova a cancellare la riga dell'altro: la RLS non la trova.
    await intruder.client.from("workout_sessions").update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", w.id);
    expect(await count("workout_sessions", u1.id)).toBe(1);
  });

  it("limite giornaliero: il database risponde RL001, i dati restano in coda", async () => {
    const u = await newUser("limite");
    const a = await phone(u.email);
    // Il contatore di oggi è già al limite (2000 per il peso).
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await admin.from("write_counters").upsert({ user_id: u.id, table_name: "body_weights", day: today, count: 2000 });
    expect(error).toBeNull();
    a.weights.set([{ day: "2026-10-04", kg: 70 }]);
    expect((await a.sync()).outcome).toBe("limit");
    expect(a.db.dirty("body-weights")).toHaveLength(1);

    await admin.from("write_counters").delete().eq("user_id", u.id); // "il giorno dopo"
    expect((await a.sync()).outcome).toBe("synced");
    expect(await count("body_weights", u.id)).toBe(1);
  });
});
