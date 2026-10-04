// Spazio dell'app su un dispositivo (deciso con l'utente: al massimo 5 GB).
// 1 GB basta per decenni di dati (diario, pasti, allenamenti occupano pochi MB)
// e resta dentro i limiti dei browser su iPhone. Oggi si mostra soltanto;
// servirà a fermare i file grandi quando arriveranno le foto dei progressi.

export const LOCAL_QUOTA_BYTES = 1e9;
const NEAR_FULL = 0.9;

export function nearlyFull(usedBytes: number): boolean {
  return usedBytes >= LOCAL_QUOTA_BYTES * NEAR_FULL;
}

/** Spazio occupato dall'app su questo dispositivo, o null se il browser non lo dice. */
export async function localUsage(): Promise<number | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return estimate?.usage ?? null;
  } catch {
    return null;
  }
}
