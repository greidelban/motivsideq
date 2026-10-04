import { execSync } from "node:child_process";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { IDBFactory } from "fake-indexeddb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { keyIdOf, newDataKey, newRecoveryCode, parseRecoveryCode, unwrapDataKey, vaultCipher, wrapDataKey } from "@/lib/crypto/vault";
import { openIdbBackend } from "@/lib/storage/backends";
import { ALL_DEFS, DEFS, SYNCED_COLLECTIONS } from "@/lib/storage/definitions";
import { createLocalDb } from "@/lib/storage/local-db";
import { type SyncState, syncOnce } from "./engine";
import { createServerKey, fetchServerKey, resetServerVault, supabaseRemote } from "./supabase-remote";

// Prova completa contro Supabase SUL PC (npm run db:local): account finti,
// RLS vera, PostgREST vero, migrazioni vere, cifratura vera. Non tocca mai il
// progetto online. Si lancia con: npm run test:e2e

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

async function newUser(name: string, plan: "free" | "pro" = "pro") {
  const email = `${name}-${Date.now()}@getcontrol.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  users.push({ id: data.user.id, email });
  if (plan === "pro") {
    const { error: planError } = await admin.from("profiles").update({ plan: "pro" }).eq("id", data.user.id);
    if (planError) throw planError;
  }
  return { id: data.user.id, email };
}

async function signIn(email: string) {
  const client = createClient(local.API_URL, local.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return { client, userId: data.user.id };
}

/** Un "telefono": archivio locale suo, sessione sua, chiave dati data. */
async function phone(email: string, dataKey: Uint8Array<ArrayBuffer>) {
  const { client, userId } = await signIn(email);
  const db = createLocalDb({ defs: ALL_DEFS, open: () => openIdbBackend(new IDBFactory()), legacy: null });
  await db.start();
  const cipher = await vaultCipher(dataKey);
  let state: SyncState | null = null;
  return {
    client,
    userId,
    db,
    weights: db.store(DEFS.bodyWeights),
    workouts: db.store(DEFS.workouts),
    profile: db.store(DEFS.profile),
    async sync() {
      const report = await syncOnce({ db, remote: supabaseRemote(client), cipher, collections: SYNCED_COLLECTIONS, state, userId });
      state = report.state;
      await db.flush();
      return report;
    },
  };
}

/** Primo dispositivo: chiave nuova e codice di recupero, come prepareVault(). */
async function activate(email: string) {
  const { client } = await signIn(email);
  const dataKey = newDataKey();
  const code = newRecoveryCode();
  expect(await createServerKey(client, { keyId: await keyIdOf(dataKey), wrappedKey: await wrapDataKey(parseRecoveryCode(code)!, dataKey) })).toBe(true);
  return { dataKey, code };
}

const rowsOf = async (userId: string) => {
  const { data, error } = await admin.from("vault_records").select("*").eq("user_id", userId);
  if (error) throw error;
  return data;
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

describe("cloud cifrato con Supabase vero (locale)", () => {
  it("primo accesso: tutto arriva una volta sola e il gestore non legge niente", async () => {
    const u = await newUser("uno");
    const { dataKey } = await activate(u.email);
    const a = await phone(u.email, dataKey);
    a.weights.set([{ day: "2026-10-01", kg: 70 }]);
    a.workouts.set([workout(), workout(45)]);
    a.profile.set({ displayName: "Loki", sex: "female", birthYear: 1995, birthMonth: 3 });
    expect(await a.sync()).toMatchObject({ outcome: "synced", pushed: 4 });
    expect(await a.sync()).toMatchObject({ outcome: "synced", pushed: 0 });

    // Quello che vede il gestore con la chiave di servizio: niente di leggibile.
    const rows = await rowsOf(u.id);
    expect(rows).toHaveLength(4);
    const visible = JSON.stringify(rows);
    for (const word of ["Loki", "female", "running", "2026-10-01", "body-weights", "workouts", "1995"]) expect(visible, word).not.toContain(word);
    const { data: profile } = await admin.from("profiles").select("*").eq("id", u.id).single();
    expect(Object.keys(profile!).sort()).toEqual(["created_at", "id", "plan", "server_updated_at", "updated_at"]);
  });

  it("nuovo telefono con il codice di recupero: ritrova tutto; modifiche e cancellazioni arrivano all'altro", async () => {
    const u = await newUser("due");
    const { dataKey, code } = await activate(u.email);
    const a = await phone(u.email, dataKey);
    const w = workout();
    a.workouts.set([w]);
    a.weights.set([{ day: "2026-10-04", kg: 70 }]);
    await a.sync();

    // Sul telefono nuovo c'è solo il codice: la chiave si recupera dal cloud.
    const { client } = await signIn(u.email);
    const server = await fetchServerKey(client);
    const recovered = await unwrapDataKey(parseRecoveryCode(code.toLowerCase())!, server!.wrappedKey);
    expect(await unwrapDataKey(parseRecoveryCode(newRecoveryCode())!, server!.wrappedKey)).toBeNull();
    const b = await phone(u.email, recovered!);
    await b.sync();
    expect(b.workouts.get()).toEqual([w]);

    b.weights.set([{ day: "2026-10-04", kg: 69.5 }]);
    b.workouts.set([]);
    await b.sync();
    await a.sync();
    expect(a.weights.get()).toEqual([{ day: "2026-10-04", kg: 69.5 }]);
    expect(a.workouts.get()).toEqual([]);
  });

  it("un account non vede e non tocca i dati di un altro", async () => {
    const u1 = await newUser("tre");
    const u2 = await newUser("quattro");
    const k1 = await activate(u1.email);
    await activate(u2.email);
    const a = await phone(u1.email, k1.dataKey);
    a.workouts.set([workout()]);
    await a.sync();

    const { client: intruder } = await signIn(u2.email);
    const { data } = await intruder.from("vault_records").select("*");
    expect(data).toEqual([]);
    const { data: keys } = await intruder.from("user_keys").select("*").eq("user_id", u1.id);
    expect(keys).toEqual([]);
    await intruder.from("vault_records").update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", u1.id);
    expect((await rowsOf(u1.id)).every((r) => r.deleted_at === null)).toBe(true);
  });

  it("senza abbonamento il cloud non si attiva e non si scrive", async () => {
    const u = await newUser("gratis", "free");
    const { client } = await signIn(u.email);
    const dataKey = newDataKey();
    await expect(createServerKey(client, { keyId: await keyIdOf(dataKey), wrappedKey: await wrapDataKey(parseRecoveryCode(newRecoveryCode())!, dataKey) })).rejects.toThrow();
    const a = await phone(u.email, dataKey);
    a.workouts.set([workout()]);
    expect((await a.sync()).outcome).toBe("plan");
    expect(await rowsOf(u.id)).toEqual([]);
  });

  it("dopo \"ricomincia da zero\" un telefono con la chiave vecchia non scrive più", async () => {
    const u = await newUser("reset");
    const { dataKey } = await activate(u.email);
    const old = await phone(u.email, dataKey);
    old.workouts.set([workout()]);
    await old.sync();

    await resetServerVault(old.client);
    expect(await rowsOf(u.id)).toEqual([]);
    await activate(u.email); // chiave nuova da un altro dispositivo
    old.workouts.set([workout(), workout(20)]);
    expect((await old.sync()).outcome).toBe("key");
    expect(await rowsOf(u.id)).toEqual([]);
  });

  it("limite giornaliero: il database risponde RL001, i dati restano in coda", async () => {
    const u = await newUser("limite");
    const { dataKey } = await activate(u.email);
    const a = await phone(u.email, dataKey);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await admin.from("write_counters").upsert({ user_id: u.id, table_name: "vault_records", day: today, count: 50000 });
    expect(error).toBeNull();
    a.weights.set([{ day: "2026-10-04", kg: 70 }]);
    expect((await a.sync()).outcome).toBe("limit");
    expect(a.db.dirty("body-weights")).toHaveLength(1);

    await admin.from("write_counters").delete().eq("user_id", u.id); // "il giorno dopo"
    expect((await a.sync()).outcome).toBe("synced");
    expect(await rowsOf(u.id)).toHaveLength(1);
  });
});
