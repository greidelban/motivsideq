// Service worker minimo: rende l'app installabile e mostra una pagina offline.
// Non mette in cache nessuna risposta: i dati dell'utente non restano sul
// dispositivo fuori dal controllo della sessione.

// Testi della pagina offline: lingua del dispositivo, inglese come base.
const OFFLINE_TEXT = {
  en: { lang: "en", title: "You are offline", body: "Check your connection: as soon as it is back, try again.", retry: "Try again" },
  it: { lang: "it", title: "Sei offline", body: "Controlla la connessione: appena torna, riprova.", retry: "Riprova" },
};

function offlineHtml() {
  const lang = (self.navigator.language || "en").slice(0, 2);
  const t = OFFLINE_TEXT[lang] || OFFLINE_TEXT.en;
  return `<!doctype html>
<html lang="${t.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t.title}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0e1a;color:#f5f1e6;font:17px/1.4 system-ui,sans-serif;text-align:center;padding:24px}
  p{color:#a6a0b0;max-width:28ch;margin:8px auto 24px}
  button{min-height:44px;padding:0 20px;border:0;border-radius:999px;background:#b026ff;color:#fff;font:600 16px system-ui,sans-serif}
</style></head>
<body><main><h1>${t.title}</h1><p>${t.body}</p>
<button onclick="location.reload()">${t.retry}</button></main></body></html>`;
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(offlineHtml(), { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
