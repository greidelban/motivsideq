// Service worker: rende l'app installabile e utilizzabile anche offline (i dati
// dell'utente stanno già sul dispositivo, in IndexedDB).
// Si conservano solo le pagine HTML e i file dell'app, che non contengono dati
// dell'utente: le pagine si generano senza conoscerli (li legge il telefono).
//  * pagine: prima la rete (sempre fresche), la copia salvata solo senza rete;
//  * file dell'app (/_next/static, font, icone): hanno un nome che cambia a ogni
//    versione, quindi si salvano una volta e si riusano;
//  * preparazione: quando la pagina lo chiede (online e a riposo), si scaricano
//    in anticipo le schermate principali con i loro file, così funzionano offline
//    anche quelle mai aperte. Solo se è uscita una versione nuova o è cambiata la
//    lingua; i file delle versioni vecchie si tolgono.
// Mai in cache: altri siti (Supabase), richieste non GET, indirizzi con parametri.

const VERSION = "v2";
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const SIGNATURE = "/__sw-signature";

// Schermate preparate per l'uso offline.
const ROUTES = [
  "/today",
  "/mind",
  "/mind/wake-up",
  "/mind/light",
  "/mind/reaction",
  "/mind/colors",
  "/mind/math",
  "/mind/schulte",
  "/journal",
  "/health/training",
  "/health/food",
  "/health/cycle",
  "/settings",
  "/settings/wallpaper",
  "/chat",
  "/privacy",
];

// Testi della pagina offline: lingua del dispositivo, inglese come base.
const OFFLINE_TEXT = {
  en: { lang: "en", title: "You are offline", body: "This page isn't saved on this device yet. Check your connection and try again.", retry: "Try again" },
  it: { lang: "it", title: "Sei offline", body: "Questa pagina non è ancora salvata su questo dispositivo. Controlla la connessione e riprova.", retry: "Riprova" },
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

const isAsset = (url) =>
  url.pathname.startsWith("/_next/static/") || /\.(woff2?|png|svg|ico|webmanifest)$/.test(url.pathname);

// Una pagina si conserva solo se è proprio quella chiesta, completa e senza parametri.
const cacheablePage = (url, res) => res.ok && !res.redirected && res.type === "basic" && url.search === "";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, ASSETS]);
      for (const name of await caches.keys()) if (!keep.has(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(page(req, url));
  } else if (isAsset(url)) {
    event.respondWith(asset(req));
  }
  // Il resto (dati delle navigazioni interne di Next) passa dalla rete: senza
  // rete Next ricarica la pagina intera, e la serve la copia salvata qui sopra.
});

async function page(req, url) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    if (cacheablePage(url, res)) await cache.put(url.pathname, res.clone());
    return res;
  } catch {
    const saved = (await cache.match(url.pathname)) || (url.pathname === "/" ? await cache.match("/today") : undefined);
    return saved || new Response(offlineHtml(), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

async function asset(req) {
  const cache = await caches.open(ASSETS);
  const saved = await cache.match(req, { ignoreSearch: false });
  if (saved) return saved;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") await cache.put(req, res.clone());
  return res;
}

// --- Preparazione per l'offline ----------------------------------------------------

const STATIC_REF = /\/_next\/static\/[^"'\s)\\]+/g;

let warming = null;

self.addEventListener("message", (event) => {
  if (event.data?.type === "warm") {
    warming ??= warm(String(event.data.lang || "")).finally(() => {
      warming = null;
    });
    event.waitUntil(warming);
  }
});

async function warm(lang) {
  const pages = await caches.open(PAGES);
  const assets = await caches.open(ASSETS);
  // La versione dell'app si riconosce dai file che usa la pagina di Oggi.
  const today = await fetch("/today", { cache: "no-store", credentials: "same-origin" });
  if (!cacheablePage(new URL(today.url), today)) return;
  const todayHtml = await today.clone().text();
  const signature = `${lang}|${[...new Set(todayHtml.match(STATIC_REF) || [])].sort().join(",")}`;
  const previous = await pages.match(SIGNATURE);
  if (previous && (await previous.text()) === signature) return;

  const wanted = new Set();
  for (const route of ROUTES) {
    try {
      const res = route === "/today" ? today : await fetch(route, { cache: "no-store", credentials: "same-origin" });
      if (!cacheablePage(new URL(res.url), res)) continue;
      const html = route === "/today" ? todayHtml : await res.clone().text();
      await pages.put(route, res);
      for (const ref of html.match(STATIC_REF) || []) wanted.add(new URL(ref, self.location.origin).href);
    } catch {
      return; // rete caduta: si riprova la prossima volta
    }
  }
  for (const href of [...wanted]) {
    let res = await assets.match(href);
    if (!res) {
      try {
        res = await fetch(href);
      } catch {
        return;
      }
      if (!res.ok) continue;
      await assets.put(href, res.clone());
    }
    // I fogli di stile citano altri file (font): servono anche quelli.
    if (href.endsWith(".css")) {
      for (const ref of (await res.text()).match(STATIC_REF) || []) {
        const inner = new URL(ref, self.location.origin).href;
        if (wanted.has(inner)) continue;
        wanted.add(inner);
        if (await assets.match(inner)) continue;
        try {
          const font = await fetch(inner);
          if (font.ok) await assets.put(inner, font);
        } catch {
          return;
        }
      }
    }
  }
  // File di versioni vecchie: non servono più a nessuna pagina salvata.
  for (const req of await assets.keys()) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/_next/static/") && !wanted.has(url.href)) await assets.delete(req);
  }
  await pages.put(SIGNATURE, new Response(signature));
}
