// Cifratura end-to-end dei dati dell'utente nel cloud ("caveau").
//
// Una chiave dati (32 byte casuali) nasce sul primo dispositivo e non lascia mai
// i dispositivi in chiaro: al server arriva solo impacchettata con il codice di
// recupero, che conosce soltanto l'utente. Dalla chiave dati derivano (HKDF):
//  * la chiave che cifra ogni elemento (AES-GCM, nonce casuale);
//  * la chiave che calcola l'id delle righe (HMAC): il server non vede né il tipo
//    di dato né il giorno, solo un id casuale, il testo cifrato e le date di modifica;
//  * l'impronta della chiave (keyId), con cui il server rifiuta righe cifrate con
//    una chiave non più valida.
// Il codice di recupero ha 160 bit casuali: non serve una derivazione lenta, non
// si può indovinare. Solo WebCrypto, niente librerie esterne.

const VERSION = "v1";
const SALT = new TextEncoder().encode("getcontrol-vault");
const WRAP_AAD = new TextEncoder().encode("getcontrol-key-v1");
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const subtle = () => globalThis.crypto.subtle;

const DATA_KEY_BYTES = 32;
const CODE_BYTES = 20;
const CODE_GROUP = 4;

/**
 * Contenuto cifrato di una riga: elenco locale, chiave, valore (null = cancellato),
 * data di creazione e, dal 6/10/2026, se è cancellata (d): così chi gestisce il
 * server non può segnare come cancellato un elemento (deleted_at è in chiaro).
 */
type Sealed = { c: string; k: string; v: unknown; ca: string; d?: boolean };

export type VaultCipher = {
  keyId: string;
  recordId(collection: string, key: string): Promise<string>;
  seal(id: string, content: Sealed): Promise<string>;
  open(id: string, payload: string): Promise<Sealed>;
};

// --- Codifiche -----------------------------------------------------------------

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const toHex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

// Base32 di Crockford: niente I, L, O, U (non si confondono con 1 e 0).
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function toBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(text: string): Uint8Array<ArrayBuffer> | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of text) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) return null;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

// --- Chiavi ----------------------------------------------------------------------

export function newDataKey(): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(DATA_KEY_BYTES));
}

async function derive(material: Uint8Array<ArrayBuffer>, info: string, kind: "aes" | "hmac"): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", material, "HKDF", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: SALT, info: encoder.encode(info) },
    base,
    kind === "aes" ? { name: "AES-GCM", length: 256 } : { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    kind === "aes" ? ["encrypt", "decrypt"] : ["sign"],
  );
}

async function hmacHex(key: CryptoKey, text: string): Promise<string> {
  return toHex(await subtle().sign("HMAC", key, encoder.encode(text)));
}

/** Impronta pubblica della chiave dati (32 caratteri esadecimali): non rivela la chiave. */
export async function keyIdOf(dataKey: Uint8Array<ArrayBuffer>): Promise<string> {
  return (await hmacHex(await derive(dataKey, "key-id", "hmac"), "key-id")).slice(0, 32);
}

async function aesSeal(key: CryptoKey, plain: Uint8Array<ArrayBuffer>, aad: Uint8Array<ArrayBuffer>): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, plain));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return `${VERSION}.${toBase64(out)}`;
}

async function aesOpen(key: CryptoKey, payload: string, aad: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const [version, body] = payload.split(".", 2);
  if (version !== VERSION || !body) throw new Error("Formato cifrato sconosciuto");
  const bytes = fromBase64(body);
  const plain = await subtle().decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12), additionalData: aad }, key, bytes.slice(12));
  return new Uint8Array(plain);
}

/** Tutto ciò che serve per cifrare e decifrare le righe di un utente. */
export async function vaultCipher(dataKey: Uint8Array<ArrayBuffer>): Promise<VaultCipher> {
  const [encryptKey, idKey, keyId] = await Promise.all([derive(dataKey, "record", "aes"), derive(dataKey, "record-id", "hmac"), keyIdOf(dataKey)]);
  return {
    keyId,
    recordId: (collection, key) => hmacHex(idKey, `${collection}\u0000${key}`),
    // L'id fa da "dato associato": una riga cifrata non si può spostare su un altro id.
    seal: (id, content) => aesSeal(encryptKey, encoder.encode(JSON.stringify(content)), encoder.encode(id)),
    open: async (id, payload) => JSON.parse(decoder.decode(await aesOpen(encryptKey, payload, encoder.encode(id)))) as Sealed,
  };
}

// --- Codice di recupero -------------------------------------------------------------

/** Nuovo codice di recupero: 32 caratteri in gruppi da 4 (es. "7K2M-...-Q9TZ"). */
export function newRecoveryCode(): string {
  const raw = toBase32(globalThis.crypto.getRandomValues(new Uint8Array(CODE_BYTES)));
  return raw.match(new RegExp(`.{1,${CODE_GROUP}}`, "g"))!.join("-");
}

/** Codice scritto dall'utente → byte, o null se non è valido (tollera spazi, trattini, minuscole, O/0, I/L/1). */
export function parseRecoveryCode(input: string): Uint8Array<ArrayBuffer> | null {
  const clean = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (clean.length !== Math.ceil((CODE_BYTES * 8) / 5)) return null;
  const bytes = fromBase32(clean);
  return bytes && bytes.length === CODE_BYTES ? bytes : null;
}

/** Chiave dati impacchettata con il codice: è l'unica cosa che il server conserva. */
export async function wrapDataKey(code: Uint8Array<ArrayBuffer>, dataKey: Uint8Array<ArrayBuffer>): Promise<string> {
  return aesSeal(await derive(code, "recovery-wrap", "aes"), dataKey, WRAP_AAD);
}

/** Recupera la chiave dati con il codice; null se il codice è sbagliato. */
export async function unwrapDataKey(code: Uint8Array<ArrayBuffer>, wrapped: string): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const key = await aesOpen(await derive(code, "recovery-wrap", "aes"), wrapped, WRAP_AAD);
    return key.length === DATA_KEY_BYTES ? key : null;
  } catch {
    return null;
  }
}
