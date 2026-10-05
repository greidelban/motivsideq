// Configurazione pubblica delle frasi sponsorizzate (vedi .env.example).
// Le variabili NEXT_PUBLIC_* vanno lette per nome esatto, altrimenti Next non le
// inserisce nel bundle. Senza entrambe gli sponsor non esistono: nessun download,
// nessuna voce nelle impostazioni.

export type SponsorConfig = { feedUrl: string; publicKey: string };

/** Indirizzo del file firmato: https (http solo sul PC, per le prove). */
function feedUrl(raw: string | undefined): string | null {
  try {
    const url = new URL(raw ?? "");
    const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    // Niente parametri: la richiesta deve essere identica per tutti.
    if (url.search || url.hash || url.username || url.password) return null;
    return url.protocol === "https:" || (local && url.protocol === "http:") ? url.href : null;
  } catch {
    return null;
  }
}

export function sponsorConfig(): SponsorConfig | null {
  const url = feedUrl(process.env.NEXT_PUBLIC_SPONSOR_FEED_URL);
  const publicKey = (process.env.NEXT_PUBLIC_SPONSOR_PUBLIC_KEY ?? "").trim();
  if (!url || !/^[A-Za-z0-9+/]{80,}={0,2}$/.test(publicKey)) return null;
  return { feedUrl: url, publicKey };
}

/** Origine del file (per la Content-Security-Policy), o null se gli sponsor sono spenti. */
export function sponsorFeedOrigin(): string | null {
  const config = sponsorConfig();
  return config ? new URL(config.feedUrl).origin : null;
}
