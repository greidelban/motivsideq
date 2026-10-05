// Crea la coppia di chiavi per firmare il file delle frasi sponsorizzate.
// La chiave PRIVATA si salva FUORI dal progetto (mai su git, mai in chat):
//   predefinito ~/.getcontrol/sponsor-private-key.json, oppure il percorso dato
//   come argomento. Chi la possiede può far comparire frasi nell'app: va custodita
//   come una password (copia in un gestore di password o in un posto sicuro).
// La chiave PUBBLICA va in .env.local come NEXT_PUBLIC_SPONSOR_PUBLIC_KEY.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const target = resolve(process.argv[2] ?? join(homedir(), ".getcontrol", "sponsor-private-key.json"));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");

if (target.startsWith(repo)) {
  console.error("La chiave privata non va salvata dentro il progetto: scegli un percorso fuori da", repo);
  process.exit(1);
}
if (existsSync(target)) {
  console.error(`Esiste già una chiave in ${target}: non la sovrascrivo (l'app che usa la sua chiave pubblica smetterebbe di accettare i file).`);
  process.exit(1);
}

const { privateKey, publicKey } = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", privateKey);
const spki = Buffer.from(await crypto.subtle.exportKey("spki", publicKey)).toString("base64");

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(jwk, null, 2), { mode: 0o600 });

console.log(`Chiave privata salvata in ${target} (non condividerla).`);
console.log("\nChiave pubblica, da mettere in .env.local:");
console.log(`NEXT_PUBLIC_SPONSOR_PUBLIC_KEY=${spki}`);
