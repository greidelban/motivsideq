import { NextResponse, type NextRequest } from "next/server";

// Il proxy applica la Content-Security-Policy con un nonce per richiesta.
// L'account non usa sessioni lato server: accesso e sincronizzazione avvengono
// nel browser (src/lib/supabase/client.ts), quindi qui non serve altro.

/** Origine del progetto Supabase (https; http solo per quello sul PC), o null se non configurato. */
function supabaseOrigin(): string | null {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    return url.protocol === "https:" || (local && url.protocol === "http:") ? url.origin : null;
  } catch {
    return null;
  }
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const supabase = supabaseOrigin();
  return [
    "default-src 'self'",
    // React in sviluppo usa eval per gli stack trace; in produzione no.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Gli attributi style="" (larghezze delle barre, colori calcolati) richiedono unsafe-inline:
    // gli stili non eseguono codice, gli script restano bloccati dal nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // Supabase (account e sincronizzazione), se configurato. In sviluppo serve
    // anche il WebSocket dell'aggiornamento a caldo di Next.
    `connect-src 'self'${supabase ? ` ${supabase}` : ""}${isDev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/today", request.url));
  }

  // Next legge il nonce dall'header CSP della richiesta e lo applica ai suoi script.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Esclusi: file statici, immagini, icone, manifest e service worker.
      source: "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|icons/|manifest.webmanifest|sw.js).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
