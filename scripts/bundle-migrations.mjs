// Unisce le migrazioni di supabase/migrations/ in un solo file da incollare
// nello SQL Editor di Supabase (in ordine di nome). Il file generato non va su git.
// Con un argomento (es. npm run db:bundle -- 20261004130000) unisce solo le
// migrazioni da quel nome in poi: quelle nuove, da eseguire su un database già pronto.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));
const out = fileURLToPath(new URL("../supabase/setup-completo.sql", import.meta.url));
const from = process.argv[2] ?? "";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql") && f >= from).sort();

const sql = files.map((f) => `-- >>> ${f}\n${readFileSync(dir + f, "utf8")}`).join("\n\n");
writeFileSync(out, `begin;\n\n${sql}\n\ncommit;\n`);
console.log(`Scritto supabase/setup-completo.sql (${files.length} migrazioni, ${sql.split("\n").length} righe).`);
