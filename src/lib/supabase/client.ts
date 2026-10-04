"use client";

import { type Session, type SupabaseClient, createClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { supabaseConfig } from "./config";

// Un solo client nel browser. La sessione (token che si rinnova da solo) resta
// nel localStorage del dispositivo; i permessi sui dati li decide la RLS del
// database, mai l'app. Senza configurazione restituisce null: niente account.

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = typeof window === "undefined" ? null : supabaseConfig();
  client = config
    ? createClient(config.url, config.anonKey, {
        auth: {
          storageKey: "getcontrol-auth",
          persistSession: true,
          autoRefreshToken: true,
          // I link delle email li gestisce /auth/confirm (token_hash), non l'URL.
          detectSessionInUrl: false,
        },
      })
    : null;
  return client;
}

// Stato della sessione per React: undefined = ancora da leggere, null = non connesso.
let current: Session | null | undefined;
const listeners = new Set<() => void>();
let watching = false;

function watch() {
  if (watching) return;
  const supabase = getSupabase();
  if (!supabase) {
    current = null;
    return;
  }
  watching = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    current = session;
    listeners.forEach((l) => l());
  });
}

function subscribe(cb: () => void) {
  watch();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSession(): Session | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => undefined,
  );
}

/** L'account è disponibile (Supabase configurato)? */
export function accountAvailable(): boolean {
  return supabaseConfig() !== null;
}
