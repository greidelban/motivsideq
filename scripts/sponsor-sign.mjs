// Firma il file delle frasi sponsorizzate da pubblicare (es. su un hosting statico).
//   node scripts/sponsor-sign.mjs <slot.json> [file-firmato.json] [chiave-privata.json]
// <slot.json>: { "slots": [{ "id", "sponsor", "date": "AAAA-MM-GG", "text": { "en", "it" } }] }
// (esempio: scripts/sponsor-slots.example.json). Massimo 10 slot, ognuno vale un giorno.
// Le regole sui temi vietati le applica comunque l'app; qui si controllano per
// avvisare prima di pubblicare (con Node 22.18 o più recente).
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const [input, output = "sponsor-feed.json", keyFile = join(homedir(), ".getcontrol", "sponsor-private-key.json")] = process.argv.slice(2);
if (!input) {
  console.error("Uso: node scripts/sponsor-sign.mjs <slot.json> [file-firmato.json] [chiave-privata.json]");
  process.exit(1);
}

const { slots } = JSON.parse(readFileSync(input, "utf8"));
const problems = [];
if (!Array.isArray(slots)) problems.push('manca l\'elenco "slots"');
else {
  if (slots.length > 10) problems.push(`${slots.length} slot: il massimo è 10`);
  const ids = new Set();
  for (const s of slots) {
    const where = `slot "${s?.id}"`;
    if (!/^[a-z0-9-]{1,40}$/.test(s?.id ?? "")) problems.push(`${where}: id solo con a-z, 0-9 e trattini`);
    if (ids.has(s.id)) problems.push(`${where}: id ripetuto`);
    ids.add(s.id);
    if (!s.sponsor || s.sponsor.length > 40) problems.push(`${where}: nome dello sponsor da 1 a 40 caratteri`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date ?? "")) problems.push(`${where}: data AAAA-MM-GG`);
    if (!s.text?.en) problems.push(`${where}: manca il testo inglese (text.en)`);
    for (const [lang, t] of Object.entries(s.text ?? {})) {
      if (typeof t !== "string" || t.length > 200) problems.push(`${where}: testo ${lang} oltre 200 caratteri`);
      if (/https?:|www\./i.test(t)) problems.push(`${where}: niente link nel testo (${lang})`);
    }
  }
}

try {
  const { forbiddenTerms } = await import("../src/lib/quotes/content-rules.ts");
  for (const s of slots ?? []) {
    for (const [lang, t] of Object.entries(s.text ?? {})) {
      if (lang !== "en" && lang !== "it") continue;
      for (const f of forbiddenTerms(t, lang)) problems.push(`slot "${s.id}": tema vietato (${f.topic}: "${f.term}") in ${lang}: l'app lo scarterebbe`);
    }
  }
} catch {
  console.warn("(Controllo dei temi vietati saltato: serve Node 22.18 o più recente. L'app li scarta comunque.)");
}

if (problems.length) {
  console.error("Il file non è stato firmato:\n- " + problems.join("\n- "));
  process.exit(1);
}

const jwk = JSON.parse(readFileSync(keyFile, "utf8"));
const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
const payload = JSON.stringify({ v: 1, issuedAt: new Date().toISOString(), slots });
const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(payload));
writeFileSync(output, JSON.stringify({ v: 1, payload, signature: Buffer.from(signature).toString("base64") }) + "\n");
console.log(`Firmato ${output} (${slots.length} slot). Pubblicalo all'indirizzo di NEXT_PUBLIC_SPONSOR_FEED_URL.`);
