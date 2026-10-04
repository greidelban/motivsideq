"use client";

import { openIdbBackend } from "./backends";
import { ALL_DEFS } from "./definitions";
import { createLocalDb, useLocalDbReady } from "./local-db";

// L'archivio locale dell'app (uno per scheda del browser). Parte da solo nel
// browser; sul server non fa nulla e gli store restituiscono i valori iniziali.

const browser = typeof window !== "undefined";

function legacyStorage(): Storage | null {
  try {
    return browser ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const localDb = createLocalDb({
  defs: ALL_DEFS,
  open: () => openIdbBackend(),
  legacy: legacyStorage(),
  channel: browser && "BroadcastChannel" in window ? new BroadcastChannel("ritmo-local-db") : null,
});

if (browser) {
  void localDb.start();
  // Nell'app installata si chiede al browser di non cancellare i dati per
  // liberare spazio (su iPhone è la differenza tra tenerli e perderli).
  // Nel browser normale no: Firefox mostrerebbe una richiesta di permesso.
  if (window.matchMedia?.("(display-mode: standalone)").matches) {
    void navigator.storage?.persist?.().catch(() => {});
  }
}

/** Vero quando i dati dell'utente sono caricati (prima, gli store danno i valori iniziali). */
export function useLocalData(): boolean {
  return useLocalDbReady(localDb);
}
