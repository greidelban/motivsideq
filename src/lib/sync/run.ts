"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { localDb } from "@/lib/storage/db";
import { defineStore } from "@/lib/storage/local-store";
import { getSupabase } from "@/lib/supabase/client";
import { type SyncOutcome, type SyncState, syncOnce } from "./engine";
import { supabaseRemote } from "./supabase-remote";
import { SYNC_TABLES } from "./tables";

// Quando sincronizzare: all'accesso, all'apertura dell'app, qualche secondo
// dopo ogni modifica, quando torna la rete e ogni 5 minuti. Una passata alla volta.

const AFTER_CHANGE_MS = 3_000;
const EVERY_MS = 5 * 60_000;

/** Stato per questo dispositivo: a quale account è legato e da dove riprendere. */
const syncState = defineStore(
  "sync-state",
  z.object({ userId: z.string(), cursors: z.record(z.string(), z.string()), lastPullAt: z.string().nullable() }).nullable(),
  null,
);

export type SyncStatus = {
  running: boolean;
  outcome: SyncOutcome | null;
  /** Ultima sincronizzazione riuscita (ora del telefono). */
  lastSyncAt: string | null;
  /** Modifiche ancora da inviare. */
  pending: number;
  /** L'ultima passata ha riallineato tutto dopo una lunga assenza. */
  fullResync: boolean;
};

let status: SyncStatus = { running: false, outcome: null, lastSyncAt: null, pending: 0, fullResync: false };
const listeners = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

const pendingCount = () => SYNC_TABLES.reduce((n, t) => n + localDb.dirty(t.collection).length, 0);

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
      await runOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function runOnce() {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return;
  await localDb.start();
  // Limite giornaliero raggiunto: si riprova solo dopo la mezzanotte UTC.
  if (Date.now() < limitUntil) {
    setStatus({ outcome: "limit", pending: pendingCount() });
    return;
  }

  setStatus({ running: true, pending: pendingCount() });
  const report = await syncOnce({
    db: localDb,
    remote: supabaseRemote(supabase),
    tables: SYNC_TABLES,
    state: syncState.get() as SyncState | null,
    userId: user.id,
  });
  if (report.outcome !== "otherAccount") syncState.set(report.state);
  if (report.outcome === "limit") {
    const midnight = new Date();
    midnight.setUTCHours(24, 5, 0, 0);
    limitUntil = midnight.getTime();
  }
  setStatus({
    running: false,
    outcome: report.outcome,
    pending: pendingCount(),
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

/**
 * Lega i dati di questo telefono all'account attuale (dopo la domanda
 * "c'erano dati di un altro account"): al prossimo giro si inviano tutti.
 */
export function adoptLocalData() {
  // Il nuovo account non ha questi dati: tutto torna "da inviare".
  for (const t of SYNC_TABLES) localDb.markAllDirty(t.collection);
  syncState.set(null);
  limitUntil = 0;
  void requestSync();
}

let started = false;

/** Collega i momenti in cui sincronizzare. Si chiama una volta all'avvio dell'app. */
export function startSyncLoop() {
  const supabase = getSupabase();
  if (started || !supabase) return;
  started = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (session && (event === "INITIAL_SESSION" || event === "SIGNED_IN")) void requestSync();
  });
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
