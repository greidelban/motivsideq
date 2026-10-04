"use client";

import { useEffect } from "react";
import { startSyncLoop } from "@/lib/sync/run";

/** Avvia la sincronizzazione in sottofondo (solo con un account; non disegna nulla). */
export function SyncRunner() {
  useEffect(() => {
    // La sincronizzazione non deve mai rompere l'app: un errore qui si registra e basta.
    try {
      startSyncLoop();
    } catch (error) {
      console.error("[sync] avvio non riuscito", error);
    }
  }, []);
  return null;
}
