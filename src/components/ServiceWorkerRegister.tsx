"use client";

import { useEffect } from "react";

const WARM_DELAY_MS = 4_000;

// Registra il service worker (public/sw.js) e, con la rete disponibile e la
// pagina ormai ferma, gli chiede di preparare le schermate per l'uso offline.
// Lui lo fa davvero solo se è uscita una versione nuova o è cambiata la lingua.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const warm = () => {
      if (!navigator.onLine) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: "warm", lang: document.documentElement.lang }));
      }, WARM_DELAY_MS);
    };
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(warm)
      .catch(() => {
        // Senza service worker l'app funziona lo stesso, ma non offline.
      });
    window.addEventListener("online", warm);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", warm);
    };
  }, []);
  return null;
}
