"use client";

import { useSyncExternalStore } from "react";
import * as z from "zod/mini";
import { forgetDeviceKey, loadDeviceKey, saveDeviceKey } from "@/lib/crypto/keystore";
import { keyIdOf, newDataKey, newRecoveryCode, parseRecoveryCode, unwrapDataKey, vaultCipher, wrapDataKey } from "@/lib/crypto/vault";
import { localDb } from "@/lib/storage/db";
import { ALL_DEFS, SYNCED_COLLECTIONS } from "@/lib/storage/definitions";
import { defineStore } from "@/lib/storage/local-store";
import { accountAvailable, hasStoredSession, loadSupabase, whenSupabaseLoaded } from "@/lib/supabase/client";
import { deviceOnlyCount } from "./device";
import { RemoteError, type SyncOutcome, type SyncState, syncOnce } from "./engine";
import { createServerKey, fetchPlan, fetchServerKey, resetServerVault, supabaseRemote, updateWrappedKey } from "./supabase-remote";

// Quando sincronizzare: all'accesso, all'apertura dell'app, qualche secondo
// dopo ogni modifica, quando torna la rete e ogni 5 minuti. Una passata alla volta.
// Prima di ogni passata: abbonamento attivo? chiave su questo dispositivo?

const AFTER_CHANGE_MS = 3_000;
const EVERY_MS = 5 * 60_000;

/** Stato per questo dispositivo: a quale account e chiave è legato, da dove riprendere. */
const syncState = defineStore(
  "sync-state",
  z.nullable(z.object({ userId: z.string(), keyId: z.string(), cursor: z.nullable(z.string()), lastPullAt: z.nullable(z.string()) })),
  null,
);

/**
 * Il cloud cifrato per questo account e dispositivo:
 * free = non incluso nel piano; setup = da attivare (nessuna chiave nel cloud);
 * locked = serve il codice di recupero su questo dispositivo; ready = tutto pronto.
 */
type VaultState = "free" | "setup" | "locked" | "ready";

export type SyncStatus = {
  running: boolean;
  vault: VaultState | null;
  outcome: SyncOutcome | null;
  /** Ultima sincronizzazione riuscita (ora del telefono). */
  lastSyncAt: string | null;
  /** Modifiche ancora da inviare. */
  pending: number;
  /** Righe del cloud che questo dispositivo non è riuscito a decifrare. */
  unreadable: number;
  /** L'ultima passata ha riallineato tutto dopo una lunga assenza. */
  fullResync: boolean;
};

const INITIAL: SyncStatus = { running: false, vault: null, outcome: null, lastSyncAt: null, pending: 0, unreadable: 0, fullResync: false };
let status: SyncStatus = INITIAL;
const listeners = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

const pendingCount = () => SYNCED_COLLECTIONS.reduce((n, c) => n + localDb.dirty(c).length, 0);

let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let limitUntil = 0;

/** Avvia una passata (se ce n'è già una in corso, ne segue un'altra subito dopo). */
export function requestSync(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      try {
        await runOnce();
      } catch (error) {
        // Errori prima della passata (piano, chiave): stesso trattamento della passata.
        const outcome: SyncOutcome = error instanceof RemoteError ? (error.kind === "network" ? "offline" : error.kind === "auth" ? "auth" : "error") : "error";
        setStatus({ running: false, outcome });
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function currentUser() {
  // Senza sessione salvata non c'è nessuno da sincronizzare: la libreria non si carica.
  if (!hasStoredSession()) return null;
  const supabase = await loadSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  return user ? { supabase, user } : null;
}

/** Il cloud è utilizzabile? Aggiorna lo stato e restituisce la chiave del dispositivo, se c'è. */
async function checkVault(): Promise<{ dataKey: Uint8Array<ArrayBuffer>; userId: string } | null> {
  const session = await currentUser();
  if (!session) return null;
  const { supabase, user } = session;
  if ((await fetchPlan(supabase)) !== "pro") {
    setStatus({ vault: "free" });
    return null;
  }
  const server = await fetchServerKey(supabase);
  if (!server) {
    setStatus({ vault: "setup" });
    return null;
  }
  const dataKey = await loadDeviceKey(user.id);
  if (!dataKey || (await keyIdOf(dataKey)) !== server.keyId) {
    // Chiave assente o vecchia (l'account ha ricominciato da zero altrove).
    if (dataKey) await forgetDeviceKey(user.id);
    setStatus({ vault: "locked" });
    return null;
  }
  setStatus({ vault: "ready" });
  return { dataKey, userId: user.id };
}

async function runOnce() {
  const session = await currentUser();
  if (!session) return;
  await localDb.start();
  // Limite raggiunto: si riprova solo dopo la mezzanotte UTC.
  if (Date.now() < limitUntil) {
    setStatus({ outcome: status.outcome === "full" ? "full" : "limit", pending: pendingCount() });
    return;
  }
  const vault = await checkVault();
  if (!vault) return;
  const cipher = await vaultCipher(vault.dataKey);

  let state = syncState.get() as SyncState | null;
  // Primo collegamento di questo dispositivo al caveau, o caveau ricreato con
  // una chiave nuova per lo stesso account: tutto ciò che c'è qui va (ri)caricato.
  if (!state || (state.userId === vault.userId && state.keyId !== cipher.keyId)) {
    for (const c of SYNCED_COLLECTIONS) localDb.markAllDirty(c);
    state = null;
  }

  setStatus({ running: true, pending: pendingCount() });
  const report = await syncOnce({
    db: localDb,
    remote: supabaseRemote(session.supabase),
    cipher,
    collections: SYNCED_COLLECTIONS,
    state,
    userId: vault.userId,
  });
  if (report.outcome !== "otherAccount") syncState.set(report.state);
  // Il tetto di spazio non si libera da solo, ma riprovare una volta al giorno non costa nulla.
  if (report.outcome === "limit" || report.outcome === "full") {
    const midnight = new Date();
    midnight.setUTCHours(24, 5, 0, 0);
    limitUntil = midnight.getTime();
  }
  if (report.outcome === "key") {
    await forgetDeviceKey(vault.userId);
    setStatus({ vault: "locked" });
  }
  if (report.outcome === "plan") setStatus({ vault: "free" });
  setStatus({
    running: false,
    outcome: report.outcome,
    pending: pendingCount(),
    unreadable: report.unreadable,
    fullResync: report.fullResync,
    ...(report.outcome === "synced" ? { lastSyncAt: new Date().toISOString() } : {}),
  });
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void requestSync();
  }, ms);
}

// --- Chiave e codice di recupero --------------------------------------------------

/** Un codice da mostrare all'utente; `confirm` lo rende valido solo dopo che l'ha salvato. */
export type PendingCode = { code: string; confirm(): Promise<"ok" | "exists"> };

/**
 * Attiva il cloud cifrato (primo dispositivo): crea la chiave e il codice di
 * recupero. Niente arriva al server finché l'utente non conferma di aver salvato il codice.
 */
export function prepareVault(): PendingCode {
  const code = newRecoveryCode();
  return {
    code,
    async confirm() {
      const session = await currentUser();
      if (!session) throw new RemoteError("auth", "Sessione assente");
      const dataKey = newDataKey();
      const created = await createServerKey(session.supabase, {
        keyId: await keyIdOf(dataKey),
        wrappedKey: await wrapDataKey(parseRecoveryCode(code)!, dataKey),
      });
      // Un altro dispositivo l'ha appena attivato: qui serve il suo codice.
      if (!created) {
        setStatus({ vault: "locked" });
        return "exists";
      }
      await saveDeviceKey(session.user.id, dataKey);
      syncState.set(null);
      void requestSync();
      return "ok";
    },
  };
}

/** Collega questo dispositivo con il codice di recupero. */
export async function unlockVault(input: string): Promise<"ok" | "invalid" | "wrong"> {
  const code = parseRecoveryCode(input);
  if (!code) return "invalid";
  const session = await currentUser();
  if (!session) throw new RemoteError("auth", "Sessione assente");
  const server = await fetchServerKey(session.supabase);
  if (!server) {
    setStatus({ vault: "setup" });
    return "wrong";
  }
  const dataKey = await unwrapDataKey(code, server.wrappedKey);
  if (!dataKey || (await keyIdOf(dataKey)) !== server.keyId) return "wrong";
  await saveDeviceKey(session.user.id, dataKey);
  limitUntil = 0;
  void requestSync();
  return "ok";
}

/** Nuovo codice di recupero (serve un dispositivo già collegato): il vecchio smette di funzionare. */
export async function prepareNewCode(): Promise<PendingCode> {
  const session = await currentUser();
  if (!session) throw new RemoteError("auth", "Sessione assente");
  const dataKey = await loadDeviceKey(session.user.id);
  if (!dataKey) throw new RemoteError("key", "Chiave assente");
  const code = newRecoveryCode();
  return {
    code,
    async confirm() {
      await updateWrappedKey(session.supabase, await wrapDataKey(parseRecoveryCode(code)!, dataKey));
      return "ok";
    },
  };
}

/**
 * Codice perso e nessun dispositivo collegato: cancella i dati cifrati nel
 * cloud. Quelli presenti su questo dispositivo restano e si ricaricano dopo
 * aver attivato di nuovo il cloud.
 */
export async function resetVault(): Promise<void> {
  const session = await currentUser();
  if (!session) throw new RemoteError("auth", "Sessione assente");
  await resetServerVault(session.supabase);
  await forgetDeviceKey(session.user.id);
  syncState.set(null);
  setStatus({ vault: "setup", outcome: null, lastSyncAt: null });
}

// --- Account e dispositivo ----------------------------------------------------------

/**
 * Lega i dati di questo telefono all'account attuale (dopo la domanda
 * "c'erano dati di un altro account"): al prossimo giro si inviano tutti.
 */
export function adoptLocalData() {
  syncState.set(null);
  limitUntil = 0;
  void requestSync();
}

/** Questo dispositivo è collegato al cloud cifrato (le cancellazioni devono arrivarci)? */
export function isCloudLinked(): boolean {
  return syncState.get() !== null;
}

const SYNCED = new Set(SYNCED_COLLECTIONS);

/**
 * Prima di togliere i dati dal dispositivo: un ultimo invio, poi quanti
 * elementi andrebbero persi perché non sono nel cloud (0 = nessuna perdita).
 */
export async function prepareDeviceWipe(): Promise<number> {
  await localDb.start();
  await requestSync();
  // Senza il cloud attivo niente è stato inviato: è tutto solo qui.
  const synced = status.vault === "ready" ? SYNCED : new Set<string>();
  return deviceOnlyCount(localDb, ALL_DEFS, synced);
}

/**
 * Esce dall'account e toglie da questo dispositivo tutti i dati dell'utente e
 * la chiave: restano nel cloud (cifrati) e tornano al prossimo accesso con il
 * codice di recupero. Le impostazioni del dispositivo (sfondo, animazioni) restano.
 */
export async function signOutAndWipe() {
  const session = await currentUser();
  // Prima l'uscita: una sincronizzazione già partita finisce, le prossime non trovano la sessione.
  await (await loadSupabase())?.auth.signOut({ scope: "local" });
  await running;
  if (session) await forgetDeviceKey(session.user.id);
  localDb.purgeAll();
  syncState.set(null);
  limitUntil = 0;
  setStatus(INITIAL);
  await localDb.flush();
}

let started = false;

/** Collega i momenti in cui sincronizzare. Si chiama una volta all'avvio dell'app. */
export function startSyncLoop() {
  if (started || !accountAvailable()) return;
  started = true;

  // Quando la libreria c'è (sessione salvata, o accesso dalla pagina Account).
  whenSupabaseLoaded((supabase) =>
    supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "INITIAL_SESSION" || event === "SIGNED_IN")) void requestSync();
      if (event === "SIGNED_OUT") setStatus(INITIAL);
    }),
  );
  if (hasStoredSession()) void loadSupabase();
  localDb.onLocalChange(() => {
    setStatus({ pending: pendingCount() });
    schedule(AFTER_CHANGE_MS);
  });
  window.addEventListener("online", () => void requestSync());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void requestSync();
  });
  setInterval(() => void requestSync(), EVERY_MS);
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status,
    () => status,
  );
}
