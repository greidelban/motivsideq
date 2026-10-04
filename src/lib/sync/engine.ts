import type { LocalDb } from "@/lib/storage/local-db";
import type { StoredRecord } from "@/lib/storage/records";
import type { Row, SyncTable } from "./tables";

// Sincronizzazione telefono ↔ cloud, una passata alla volta:
//  1. invia le modifiche locali (upsert in blocchi; cancellazioni come deleted_at);
//  2. scarica ciò che è cambiato nel cloud dopo l'ultima volta.
// Vince sempre la modifica più recente (updated_at), sia qui sia nel database.
// Niente React e niente rete qui dentro: il "Remote" si passa da fuori (test).

export type RemoteErrorKind = "limit" | "auth" | "network" | "other";

export class RemoteError extends Error {
  constructor(
    readonly kind: RemoteErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export interface Remote {
  /** Inserisce o aggiorna (il database applica "vince la più recente"). */
  upsert(table: string, rows: Record<string, unknown>[], onConflict: string): Promise<void>;
  /** Segna una riga come cancellata (le colonne obbligatorie restano quelle del cloud). */
  markDeleted(table: string, keyColumn: string, key: string, deletedAt: string, updatedAt: string): Promise<void>;
  /** Righe con server_updated_at > since (tutte se null), in ordine crescente. */
  pullSince(table: string, since: string | null, limit: number): Promise<Row[]>;
}

/** Stato salvato sul telefono (per utente): da dove riprendere a scaricare. */
export type SyncState = {
  userId: string;
  /** Ultimo server_updated_at visto per tabella (formato del server, microsecondi). */
  cursors: Record<string, string>;
  /** Ultimo download riuscito, ora del telefono. */
  lastPullAt: string | null;
};

export type SyncOutcome =
  | "synced"
  /** Limite giornaliero del database raggiunto: i dati restano in coda fino a domani. */
  | "limit"
  | "offline"
  /** Sessione scaduta o assente. */
  | "auth"
  /** Su questo telefono ci sono dati di un altro account: non si mischiano. */
  | "otherAccount"
  | "error";

export type SyncReport = {
  outcome: SyncOutcome;
  state: SyncState;
  pushed: number;
  pulled: number;
  /** Rimasto offline più a lungo della pulizia del cloud: riallineamento completo. */
  fullResync: boolean;
};

const OUTCOME_FOR: Record<RemoteErrorKind, SyncOutcome> = { limit: "limit", auth: "auth", network: "offline", other: "error" };

/** Le righe cancellate spariscono davvero dal cloud dopo 180 giorni. */
export const TOMBSTONE_DAYS = 180;
const PUSH_CHUNK = 200;
const PULL_PAGE = 1000;
/** Sovrapposizione del download: righe salvate in transazioni lente non si perdono. */
const PULL_OVERLAP_MS = 60_000;

const iso = (v: string) => new Date(v).toISOString();

export function emptyState(userId: string): SyncState {
  return { userId, cursors: {}, lastPullAt: null };
}

export function needsFullResync(state: SyncState, now: Date): boolean {
  if (!state.lastPullAt) return false;
  return now.getTime() - new Date(state.lastPullAt).getTime() > TOMBSTONE_DAYS * 86_400_000;
}

function rowFor(table: SyncTable<never>, r: StoredRecord) {
  const value = r.value as never;
  return {
    ...table.toRow(value),
    created_at: table.createdAt?.(value) ?? r.createdAt,
    updated_at: r.updatedAt,
    deleted_at: null,
  };
}

/** `onSent` conta anche quando un blocco successivo fallisce. */
async function push(db: LocalDb, remote: Remote, table: SyncTable<never>, onSent: (n: number) => void): Promise<void> {
  const dirty = db.dirty(table.collection);
  const live = dirty.filter((r) => r.deletedAt === null);
  const deleted = dirty.filter((r) => r.deletedAt !== null);

  // Un blocco alla volta: se la rete cade a metà, i blocchi già inviati restano
  // segnati e al nuovo tentativo si riparte da dove si era rimasti.
  for (let i = 0; i < live.length; i += PUSH_CHUNK) {
    const chunk = live.slice(i, i + PUSH_CHUNK);
    await remote.upsert(
      table.table,
      chunk.map((r) => rowFor(table, r)),
      table.conflict,
    );
    db.markClean(table.collection, chunk);
    onSent(chunk.length);
  }
  for (const r of deleted) {
    await remote.markDeleted(table.table, table.keyColumn, r.key, r.deletedAt!, r.updatedAt);
    db.markClean(table.collection, [r]);
    onSent(1);
  }
}

async function pull(db: LocalDb, remote: Remote, table: SyncTable<never>, state: SyncState, full: boolean): Promise<number> {
  const cursor = state.cursors[table.table];
  let since = full || !cursor ? null : new Date(new Date(cursor).getTime() - PULL_OVERLAP_MS).toISOString();
  const seen = new Set<string>();
  let applied = 0;
  let newest = cursor ?? null;

  for (;;) {
    const rows = await remote.pullSince(table.table, since, PULL_PAGE);
    const records = rows.map((row) => {
      const key = String(row[table.keyColumn]);
      seen.add(key);
      return {
        key,
        value: row.deleted_at ? null : table.fromRow(row),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        deletedAt: row.deleted_at ? iso(row.deleted_at) : null,
      };
    });
    applied += db.applyRemote(table.collection, records);
    for (const row of rows) {
      if (row.server_updated_at && (!newest || new Date(row.server_updated_at) > new Date(newest))) newest = row.server_updated_at;
    }
    if (rows.length < PULL_PAGE) break;
    since = rows.at(-1)!.server_updated_at ?? null;
  }

  if (full) {
    // Riallineamento completo: ciò che è già allineato ma non esiste più nel
    // cloud (cancellato da tempo e ripulito) sparisce anche qui. Le modifiche
    // locali non inviate restano: sono già partite nella fase di invio.
    const stale = db
      .records(table.collection)
      .filter((r) => !r.dirty && !seen.has(r.key))
      .map((r) => r.key);
    db.removeLocal(table.collection, stale);
  }
  if (newest) state.cursors[table.table] = newest;
  return applied;
}

export async function syncOnce({
  db,
  remote,
  tables,
  state,
  userId,
  now = new Date(),
}: {
  db: LocalDb;
  remote: Remote;
  tables: readonly SyncTable<never>[];
  state: SyncState | null;
  userId: string;
  now?: Date;
}): Promise<SyncReport> {
  // Il telefono era già legato a un altro account: niente invii che mischino i dati.
  if (state && state.userId !== userId) {
    return { outcome: "otherAccount", state, pushed: 0, pulled: 0, fullResync: false };
  }
  const next: SyncState = state ? { ...state, cursors: { ...state.cursors } } : emptyState(userId);
  const fullResync = needsFullResync(next, now);
  let pushed = 0;
  let pulled = 0;

  try {
    // Prima si invia (anche dopo mesi offline nulla va perso), poi si scarica.
    for (const table of tables) await push(db, remote, table, (n) => (pushed += n));
    for (const table of tables) pulled += await pull(db, remote, table, next, fullResync);
    next.lastPullAt = now.toISOString();
    return { outcome: "synced", state: next, pushed, pulled, fullResync };
  } catch (error) {
    const outcome = error instanceof RemoteError ? OUTCOME_FOR[error.kind] : "error";
    return { outcome, state: next, pushed, pulled, fullResync };
  }
}
