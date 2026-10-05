"use client";

import { useEffect, useState } from "react";
import { sponsoredAllowed } from "./preferences";
import { MAX_FEED_BYTES, type SponsorSlot, verifySponsorFeed } from "./sponsor";
import { sponsorConfig } from "./sponsor-config";
import { quotePrefs, sponsorFeedCache } from "./store";

// Download del file sponsor: solo con il consenso, al massimo ogni 6 ore.
// La richiesta è uguale per tutti (niente parametri, cookie, referrer o id):
// chi ospita il file non può sapere chi è l'utente né cosa vede.

const MAX_AGE = 6 * 60 * 60 * 1000;
let inflight: Promise<void> | null = null;

export function refreshSponsorFeed(): Promise<void> {
  const config = sponsorConfig();
  if (!config || !sponsoredAllowed(quotePrefs.get())) return Promise.resolve();
  const cached = sponsorFeedCache.get();
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE && cached.fetchedAt <= Date.now()) return Promise.resolve();
  inflight ??= (async () => {
    try {
      const res = await fetch(config.feedUrl, {
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        redirect: "error",
      });
      if (!res.ok) return;
      const raw = await res.text();
      if (raw.length > MAX_FEED_BYTES * 2) return;
      // Si salva solo un file con firma valida: altrimenti resta il precedente.
      const result = await verifySponsorFeed(raw, config.publicKey);
      if (result.ok && sponsoredAllowed(quotePrefs.get())) sponsorFeedCache.set({ raw, fetchedAt: Date.now() });
    } catch {
      // Offline o file irraggiungibile: si riprova alla prossima apertura.
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Slot sponsor verificati (vuoto senza consenso, senza configurazione o con firma non valida). */
export function useSponsorSlots(): SponsorSlot[] {
  const prefs = quotePrefs.use();
  const cached = sponsorFeedCache.use();
  const allowed = sponsoredAllowed(prefs);
  const raw = allowed ? (cached?.raw ?? null) : null;
  const [verified, setVerified] = useState<{ raw: string; slots: SponsorSlot[] } | null>(null);

  useEffect(() => {
    const config = sponsorConfig();
    if (!raw || !config) return;
    let cancelled = false;
    verifySponsorFeed(raw, config.publicKey).then((result) => {
      // Una copia rovinata o firmata con un'altra chiave si toglie: si riscarica alla prossima apertura.
      if (!result.ok && result.reason !== "unsupported") sponsorFeedCache.clear();
      if (!cancelled) setVerified({ raw, slots: result.ok ? result.slots : [] });
    });
    return () => {
      cancelled = true;
    };
  }, [raw]);

  return raw && verified?.raw === raw ? verified.slots : NO_SLOTS;
}

const NO_SLOTS: SponsorSlot[] = [];
