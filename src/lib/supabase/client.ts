"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { supabaseConfig } from "./config";

// Un solo client nel browser. La sessione (token che si rinnova da solo) resta
// nel localStorage del dispositivo; i permessi sui dati li decide la RLS del
// database, mai l'app. Senza configurazione: niente account.
// La libreria (circa 250 kB) si carica solo quando serve: c'è una sessione
// salvata su questo dispositivo, oppure si apre la pagina Account. Chi usa
// l'app senza account non la scarica mai.

const STORAGE_KEY = "getcontrol-auth";

let loading: Promise<SupabaseClient | null> | null = null;
let client: SupabaseClient | null = null;
const onLoaded = new Set<(c: SupabaseClient) => void>();

export function loadSupabase(): Promise<SupabaseClient | null> {
  loading ??= (async () => {
    const config = typeof window === "undefined" ? null : supabaseConfig();
    if (!config) return null;
    const { createClient } = await import("@supabase/supabase-js");
    const created = createClient(config.url, config.anonKey, {
      auth: {
        storageKey: STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        // I link delle email li gestisce /auth/confirm (token_hash), non l'URL.
        detectSessionInUrl: false,
      },
    });
    client = created;
    onLoaded.forEach((cb) => cb(created));
    return created;
  })();
  return loading;
}

/** Chiama `cb` quando il client esiste (subito, se c'è già). */
export function whenSupabaseLoaded(cb: (c: SupabaseClient) => void): void {
  if (client) cb(client);
  else onLoaded.add(cb);
}

/** C'è una sessione salvata su questo dispositivo? Se no, non serve caricare la libreria. */
export function hasStoredSession(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

// Stato della sessione per React: undefined = ancora da leggere, null = non connesso.
let current: Session | null | undefined;
const listeners = new Set<() => void>();
let watching = false;

function watch() {
  if (watching) return;
  watching = true;
  whenSupabaseLoaded((supabase) =>
    supabase.auth.onAuthStateChange((_event, session) => {
      current = session;
      listeners.forEach((l) => l());
    }),
  );
  if (accountAvailable() && hasStoredSession()) void loadSupabase();
}

function subscribe(cb: () => void) {
  watch();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function snapshot(): Session | null | undefined {
  // Senza account configurato o senza sessione salvata si sa già la risposta:
  // non connesso (anche prima che la libreria sia caricata).
  if (current === undefined && (!accountAvailable() || !hasStoredSession())) return null;
  return current;
}

export function useSession(): Session | null | undefined {
  return useSyncExternalStore(subscribe, snapshot, () => undefined);
}

/** L'account è disponibile (Supabase configurato)? */
export function accountAvailable(): boolean {
  return supabaseConfig() !== null;
}
