"use client";

import { useEffect, useState } from "react";
import { type Locale, matchLocale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

// Ultima rete di sicurezza: si è rotta anche la cornice dell'app (layout).
// Qui non ci sono né i dizionari del provider né lo stile globale: lingua dal
// browser, stile minimo scritto qui (come la pagina offline in public/sw.js).
// I dizionari si caricano solo adesso: importati direttamente finirebbero nel
// pacchetto di ogni pagina.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [texts, setTexts] = useState<{ locale: Locale; t: Dictionary["errors"] } | null>(null);

  useEffect(() => {
    const locale = matchLocale(navigator.language);
    void import("@/i18n/dictionaries").then((m) => setTexts({ locale, t: m.DICTIONARIES[locale].errors }));
  }, []);
  const t = texts?.t;

  return (
    <html lang={texts?.locale ?? "en"}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0a0e1a",
          color: "#f5f1e6",
          font: "17px/1.4 system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        {t && (
          <>
            <title>{t.title}</title>
            <main role="alert">
              <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>{t.title}</h1>
              <p style={{ color: "#cfc9ba", maxWidth: "32ch", margin: "0 auto 24px" }}>{t.text}</p>
              <button
                type="button"
                onClick={() => retry()}
                style={{ minHeight: 44, padding: "0 20px", border: 0, borderRadius: 999, background: "#b026ff", color: "#fff", font: "600 16px system-ui, sans-serif" }}
              >
                {t.retry}
              </button>
            </main>
          </>
        )}
      </body>
    </html>
  );
}
