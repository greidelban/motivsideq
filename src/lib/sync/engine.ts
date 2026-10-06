import type { VaultCipher } from "@/lib/crypto/vault";
import type { LocalDb } from "@/lib/storage/local-db";
import type { StoredRecord } from "@/lib/storage/records";

// Sincronizzazione telefono ↔ cloud cifrato, una passata alla volta:
//  1. invia le modifiche locali, cifrate (upsert in blocchi; cancellazioni come deleted_at);
//  2. scarica ciò che è cambiato nel cloud dopo l'ultima volta e lo decifra.
// Tutti gli elenchi finiscono nella stessa tabella (vault_records): il server
// vede solo id casuali, testo cifrato e date. Vince la modifica più recente
// (updated_at), sia qui sia nel database.
// Niente React e niente rete qui dentro: il "Remote" si passa da fuori (test).

export type RemoteErrorKind = "limit" | "full" | "key" | "plan" | "auth" | "network" | "other";

export class RemoteError extends Error {
  constructor(
    readonly kind: RemoteErrorKind,
    message: string,
  ) {
    super(message);
  }
}

/** Una riga del caveau, come la vede il server. */
export type VaultRow = {
  id: string;
  key_id: string;
  payload: string;
  updated_at: string;
  deleted_at: string | null;
  server_updated_at?: string;
};

export interface Remote {
  /** Inserisce o aggiorna (il database applica "vince la più recente"). */
  upsert(rows: VaultRow[]): Promise<void>;
  /** Righe con server_updated_at > since (tutte se null), in ordine crescente. */
  pullSince(since: string | null, limit: number): Promise<VaultRow[]>;
}

/** Stato salvato sul telefono: account, chiave e punto da cui riprendere a scaricare. */
export type SyncState = {
  userId: string;
  keyId: string;
  /** Ultimo server_updated_at visto (formato del server, microsecondi). */
  cursor: string | null;
  /** Ultimo download riuscito, ora del telefono. */
  lastPullAt: string | null;
};

export type SyncOutcome =
  | "synced"
  /** Limite giornaliero del database raggiunto: i dati restano in coda fino a domani. */
  | "limit"
  /** Spazio dell'account esaurito: i dati restano sul telefono. */
  | "full"
  /** La chiave di questo telefono non è più quella dell'account: serve il codice di recupero. */
  | "key"
  /** Il cloud non è incluso nel piano (abbonamento scaduto). */
  | "plan"
  | "offline"
  /** Sessione scaduta o assente. */
  | "auth"
  /** Su questo telefono ci sono dati di un altro account o di un'altra chiave: non si mischiano. */
  | "otherAccount"
  | "error";

export type SyncReport = {
  outcome: SyncOutcome;
  state: SyncState;
  pushed: number;
  pulled: number;
  /** Righe del cloud che non si sono potute decifrare (saltate). */
  unreadable: number;
  /** Rimasto offline più a lungo della pulizia del cloud: riallineamento completo. */
  fullResync: boolean;
};

const OUTCOME_FOR: Record<RemoteErrorKind, SyncOutcome> = {
  limit: "limit",
  full: "full",
  key: "key",
  plan: "plan",
  auth: "auth",
  network: "offline",
  other: "error",
};

/** Le righe cancellate spariscono davvero dal cloud dopo 180 giorni. */
const TOMBSTONE_DAYS = 180;
const PUSH_CHUNK = 200;
const PULL_PAGE = 1000;
/** Sovrapposizione del download: righe salvate in transazioni lente non si perdono. */
const PULL_OVERLAP_MS = 60_000;

const iso = (v: string) => new Date(v).toISOString();

function emptyState(userId: string, keyId: string): SyncState {
  return { userId, keyId, cursor: null, lastPullAt: null };
}

function needsFullResync(state: SyncState, now: Date): boolean {
  if (!state.lastPullAt) return false;
  return now.getTime() - new Date(state.lastPullAt).getTime() > TOMBSTONE_DAYS * 86_400_000;
}

async function sealRecord(cipher: VaultCipher, r: StoredRecord): Promise<VaultRow> {
  const id = await cipher.recordId(r.collection, r.key);
  const deleted = r.deletedAt !== null;
  return {
    id,
    key_id: cipher.keyId,
    payload: await cipher.seal(id, { c: r.collection, k: r.key, v: deleted ? null : r.value, ca: r.createdAt, d: deleted }),
    updated_at: r.updatedAt,
    deleted_at: r.deletedAt,
  };
}

/** `onSent` conta anche quando un blocco successivo fallisce. */
async function push(db: LocalDb, remote: Remote, cipher: VaultCipher, collections: readonly string[], onSent: (n: number) => void) {
  const dirty = collections.flatMap((c) => db.dirty(c));
  // Un blocco alla volta: se la rete cade a metà, i blocchi già inviati restano
  // segnati e al nuovo tentativo si riparte da dove si era rimasti.
  for (let i = 0; i < dirty.length; i += PUSH_CHUNK) {
    const chunk = dirty.slice(i, i + PUSH_CHUNK);
    await remote.upsert(await Promise.all(chunk.map((r) => sealRecord(cipher, r))));
    for (const c of collections) db.markClean(c, chunk.filter((r) => r.collection === c));
    onSent(chunk.length);
  }
}

type Incoming = { key: string; value: unknown; createdAt: string; updatedAt: string; deletedAt: string | null };

async function pull(db: LocalDb, remote: Remote, cipher: VaultCipher, collections: readonly string[], state: SyncState, full: boolean) {
  const known = new Set(collections);
  let since = full || !state.cursor ? null : new Date(new Date(state.cursor).getTime() - PULL_OVERLAP_MS).toISOString();
  const seen = new Map<string, Set<string>>(collections.map((c) => [c, new Set()]));
  let applied = 0;
  let unreadable = 0;
  let newest = state.cursor;

  for (;;) {
    const rows = await remote.pullSince(since, PULL_PAGE);
    const byCollection = new Map<string, Incoming[]>();
    for (const row of rows) {
      if (row.server_updated_at && (!newest || new Date(row.server_updated_at) > new Date(newest))) newest = row.server_updated_at;
      let content;
      try {
        content = await cipher.open(row.id, row.payload);
      } catch {
        unreadable++;
        continue;
      }
      // Un elenco che questa versione dell'app non conosce: si ignora, resta nel cloud.
      if (!known.has(content.c)) continue;
      seen.get(content.c)!.add(content.k);
      // Cancellata o no lo dice la parte cifrata (il server non può cambiarla);
      // solo le righe inviate prima del 6/10/2026 non lo contengono.
      const deleted = typeof content.d === "boolean" ? content.d : row.deleted_at !== null;
      const list = byCollection.get(content.c) ?? [];
      list.push({
        key: content.k,
        value: deleted ? null : content.v,
        createdAt: content.ca,
        updatedAt: iso(row.updated_at),
        deletedAt: deleted ? iso(row.deleted_at ?? row.updated_at) : null,
      });
      byCollection.set(content.c, list);
    }
    for (const [collection, records] of byCollection) applied += db.applyRemote(collection, records);
    if (rows.length < PULL_PAGE) break;
    since = rows.at(-1)!.server_updated_at ?? null;
  }

  if (full) {
    // Riallineamento completo: ciò che è già allineato ma non esiste più nel
    // cloud (cancellato da tempo e ripulito) sparisce anche qui. Le modifiche
    // locali non inviate restano: sono già partite nella fase di invio.
    for (const c of collections) {
      const stale = db
        .records(c)
        .filter((r) => !r.dirty && !seen.get(c)!.has(r.key))
        .map((r) => r.key);
      db.removeLocal(c, stale);
    }
  }
  state.cursor = newest;
  return { applied, unreadable };
}

export async function syncOnce({
  db,
  remote,
  cipher,
  collections,
  state,
  userId,
  now = new Date(),
}: {
  db: LocalDb;
  remote: Remote;
  cipher: VaultCipher;
  /** Elenchi locali da sincronizzare (definitions.ts, quelli con sync). */
  collections: readonly string[];
  state: SyncState | null;
  userId: string;
  now?: Date;
}): Promise<SyncReport> {
  // Il telefono era già legato a un altro account o a un'altra chiave: niente invii che mischino i dati.
  if (state && (state.userId !== userId || state.keyId !== cipher.keyId)) {
    return { outcome: "otherAccount", state, pushed: 0, pulled: 0, unreadable: 0, fullResync: false };
  }
  const next: SyncState = state ? { ...state } : emptyState(userId, cipher.keyId);
  const fullResync = needsFullResync(next, now);
  let pushed = 0;
  let pulled = 0;
  let unreadable = 0;

  try {
    // Prima si invia (anche dopo mesi offline nulla va perso), poi si scarica.
    await push(db, remote, cipher, collections, (n) => (pushed += n));
    ({ applied: pulled, unreadable } = await pull(db, remote, cipher, collections, next, fullResync));
    // I segnali di cancellazione già nel cloud non servono più qui: sul
    // dispositivo non resta traccia di ciò che è stato cancellato.
    for (const c of collections) {
      db.removeLocal(
        c,
        db
          .records(c)
          .filter((r) => r.deletedAt !== null && !r.dirty)
          .map((r) => r.key),
      );
    }
    next.lastPullAt = now.toISOString();
    return { outcome: "synced", state: next, pushed, pulled, unreadable, fullResync };
  } catch (error) {
    const outcome = error instanceof RemoteError ? OUTCOME_FOR[error.kind] : "error";
    return { outcome, state: next, pushed, pulled, unreadable, fullResync };
  }
}
