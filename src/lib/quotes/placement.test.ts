import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Regole di posizione controllate sul codice: la carta sponsor sta solo in Oggi,
// e le frasi non fanno richieste di rete tranne il download del file firmato.

const SRC = join(__dirname, "..", "..");

function sourceFiles(): { path: string; text: string }[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f))
    .map((f) => ({ path: relative(SRC, join(SRC, f)).split(sep).join("/"), text: readFileSync(join(SRC, f), "utf8") }));
}

describe("posizione degli sponsor", () => {
  const files = sourceFiles();

  it("la carta sponsor si usa solo nella pagina Oggi", () => {
    const users = files.filter((f) => /from "@\/components\/quotes\/SponsorCard"/.test(f.text)).map((f) => f.path);
    expect(users).toEqual(["app/(app)/today/page.tsx"]);
  });

  it("mai nelle schermate di ciclo, cibo, allenamento o peso", () => {
    const health = files.filter((f) => /^(app\/\(app\)\/health\/|components\/health\/|lib\/health\/)/.test(f.path));
    expect(health.length).toBeGreaterThan(0);
    for (const f of health) expect(f.text, f.path).not.toMatch(/quotes\/(sponsor|SponsorCard)/);
  });

  it("nessuna analytics: l'unica richiesta di rete delle frasi è il file firmato", () => {
    const quotes = files.filter((f) => f.path.startsWith("lib/quotes/") || f.path.startsWith("components/quotes/"));
    const withFetch = quotes.filter((f) => /\bfetch\(|sendBeacon|XMLHttpRequest|WebSocket/.test(f.text)).map((f) => f.path);
    expect(withFetch).toEqual(["lib/quotes/sponsor-feed.ts"]);
  });
});
