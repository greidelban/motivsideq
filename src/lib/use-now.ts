"use client";

import { useSyncExternalStore } from "react";

// Ora del dispositivo per l'interfaccia, aggiornata allo scoccare di ogni minuto.
// (Per misurare i tempi di risposta nei giochi c'è clock.ts.)

const MINUTE = 60_000;

function subscribe(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    timer = setTimeout(
      () => {
        onChange();
        schedule();
      },
      MINUTE - (Date.now() % MINUTE) + 20,
    );
  };
  // Al ritorno nell'app (telefono sbloccato, scheda riaperta) l'ora si aggiorna subito.
  const onVisible = () => {
    if (document.hidden) return;
    clearTimeout(timer);
    onChange();
    schedule();
  };
  schedule();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

const currentMinute = () => Math.floor(Date.now() / MINUTE);
const noMinute = () => null;

/** Inizio del minuto corrente; null sul server e prima dell'idratazione. */
export function useNow(): Date | null {
  const minute = useSyncExternalStore(subscribe, currentMinute, noMinute);
  return minute === null ? null : new Date(minute * MINUTE);
}
