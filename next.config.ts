import type { NextConfig } from "next";

// La Content-Security-Policy (con nonce per richiesta) è in src/proxy.ts.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// Gli URL della prima versione erano in italiano: li rimandiamo ai nuovi.
const LEGACY_PATHS: [string, string][] = [
  ["/oggi", "/today"],
  ["/mente/risveglio", "/mind/wake-up"],
  ["/mente/reazione", "/mind/reaction"],
  ["/mente/colori", "/mind/colors"],
  ["/mente/calcolo", "/mind/math"],
  ["/mente/:path*", "/mind/:path*"],
  ["/diario", "/journal"],
  ["/allenamento", "/health/training"],
  ["/alimentazione", "/health/food"],
  ["/impostazioni", "/settings"],
  // Palestra e Cibo sono confluiti in Salute.
  ["/gym", "/health/training"],
  ["/food", "/health/food"],
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Solo in sviluppo: permette di aprire l'app anche da 127.0.0.1 (archivio del
  // browser separato da localhost, utile per provare account di prova).
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // Le pagine già viste (e quelle del menu, precaricate) restano in memoria per
    // 5 minuti: il cambio di scheda è immediato, senza attese né scatti.
    staleTimes: { dynamic: 300, static: 300 },
  },
  async redirects() {
    return [
      ...LEGACY_PATHS.map(([source, destination]) => ({ source, destination, permanent: true })),
      // Salute non ha una pagina propria: si apre su Allenamento.
      { source: "/health", destination: "/health/training", permanent: false },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
