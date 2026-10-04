"use client";

import { useSyncExternalStore } from "react";
import type { z } from "zod";

// Salvataggio locale (localStorage) finché non c'è il backend.
// Ogni "store" ha una chiave, uno schema zod e un valore iniziale: i dati letti
// vengono validati, così un valore corrotto non rompe l'app (si torna al default).
// Quando arriverà Supabase, questi store saranno la fonte per importare i dati.

const PREFIX = "ritmo:v1:";
const CHANGE_EVENT = "ritmo:store-change";

export type LocalStore<T> = {
  key: string;
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  clear(): void;
  use(): T;
};

export function defineStore<T>(key: string, schema: z.ZodType<T>, fallback: T): LocalStore<T> {
  const storageKey = PREFIX + key;
  // Cache per restituire sempre lo stesso oggetto finché il dato non cambia
  // (useSyncExternalStore lo richiede).
  let cachedRaw: string | null | undefined;
  let cachedValue: T = fallback;

  function get(): T {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(storageKey);
    } catch {
      return fallback;
    }
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    if (raw === null) {
      cachedValue = fallback;
    } else {
      try {
        const parsed = schema.safeParse(JSON.parse(raw));
        cachedValue = parsed.success ? parsed.data : fallback;
      } catch {
        cachedValue = fallback;
      }
    }
    return cachedValue;
  }

  function write(raw: string | null) {
    try {
      if (raw === null) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, raw);
    } catch {
      // Memoria piena o accesso negato (navigazione privata): il dato resta solo in pagina.
    }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: storageKey }));
  }

  function set(next: T | ((prev: T) => T)) {
    const value = typeof next === "function" ? (next as (prev: T) => T)(get()) : next;
    write(JSON.stringify(value));
  }

  function subscribe(onChange: () => void) {
    const onLocal = (e: Event) => {
      if ((e as CustomEvent<string>).detail === storageKey) onChange();
    };
    // Altre schede dello stesso browser.
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) onChange();
    };
    window.addEventListener(CHANGE_EVENT, onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }

  return {
    key,
    get,
    set,
    clear: () => write(null),
    // Sul server e al primo render si usa il valore iniziale, poi quello salvato.
    use: () => useSyncExternalStore(subscribe, get, () => fallback),
  };
}

/** Vero dopo l'idratazione: utile per non mostrare dati "vuoti" prima di leggere lo storage. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

const noopSubscribe = () => () => {};
