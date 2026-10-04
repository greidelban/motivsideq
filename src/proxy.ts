import { NextResponse, type NextRequest } from "next/server";

// Per ora il proxy applica solo la Content-Security-Policy con un nonce per
// richiesta. Sessione e redirect del login torneranno con il backend
// (versione completa in archivio/login/src/proxy.ts).

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // React in sviluppo usa eval per gli stack trace; in produzione no.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Gli attributi style="" (Recharts, larghezze delle barre) richiedono unsafe-inline:
    // gli stili non eseguono codice, gli script restano bloccati dal nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // In sviluppo serve anche il WebSocket dell'aggiornamento a caldo di Next.
    `connect-src 'self'${isDev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
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
