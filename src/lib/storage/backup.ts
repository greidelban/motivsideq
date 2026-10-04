import * as z from "zod/mini";

// Copia di sicurezza dei dati locali in un file JSON (export) e ripristino
// (import). Indipendente da dove stanno i dati: lavora sui valori degli store.

const BACKUP_APP = "getcontrol";
/** Nome dell'app nei file esportati prima del cambio di nome: si importano ancora. */
const LEGACY_BACKUP_APPS = ["ritmo"] as const;
const BACKUP_FORMAT = 1;

export type BackupFile = {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  exportedAt: string;
  data: Record<string, unknown>;
};

/** Uno store da includere: elenchi uniti per chiave, documenti sostituiti. */
export type BackupEntry =
  | { name: string; kind: "list"; item: z.core.$ZodType; keyOf: (item: never) => string }
  | { name: string; kind: "doc"; schema: z.core.$ZodType };

const fileSchema = z.object({
  app: z.enum([BACKUP_APP, ...LEGACY_BACKUP_APPS]),
  format: z.literal(BACKUP_FORMAT),
  exportedAt: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export function buildBackup(entries: readonly BackupEntry[], read: (name: string) => unknown, now: Date = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    data: Object.fromEntries(entries.map((e) => [e.name, read(e.name)])),
  };
}

export function backupFileName(day: string): string {
  return `getcontrol-${day}.json`;
}

export type ParsedBackup = { ok: true; file: BackupFile } | { ok: false; reason: "json" | "format" };

export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "json" };
  }
  const parsed = fileSchema.safeParse(raw);
  // Un file del vecchio nome si tratta come uno nuovo.
  return parsed.success ? { ok: true, file: { ...parsed.data, app: BACKUP_APP } as BackupFile } : { ok: false, reason: "format" };
}

/** Elementi contenuti nel file (per l'anteprima prima di importare). */
export function countItems(file: BackupFile): number {
  return Object.values(file.data).reduce<number>(
    (n, value) => n + (Array.isArray(value) ? value.length : value !== null && value !== undefined ? 1 : 0),
    0,
  );
}

export type ImportPlan = {
  /** Valori da scrivere negli store (già uniti a quelli attuali). */
  writes: { name: string; value: unknown }[];
  /** Elementi letti dal file per ciascuno store. */
  counts: Record<string, number>;
  /** Elementi scartati perché non validi (es. file modificato a mano). */
  skipped: number;
};

/**
 * Prepara l'importazione senza perdere nulla: negli elenchi gli elementi del
 * file si aggiungono a quelli presenti (a parità di chiave vince il file), i
 * documenti (profilo, impostazioni) vengono sostituiti.
 */
export function planImport(entries: readonly BackupEntry[], file: BackupFile, read: (name: string) => unknown): ImportPlan {
  const plan: ImportPlan = { writes: [], counts: {}, skipped: 0 };
  for (const entry of entries) {
    if (!(entry.name in file.data)) continue;
    const incoming = file.data[entry.name];

    if (entry.kind === "doc") {
      const parsed = z.safeParse(entry.schema, incoming);
      if (parsed.success) {
        plan.writes.push({ name: entry.name, value: parsed.data });
        plan.counts[entry.name] = 1;
      } else {
        plan.skipped++;
      }
      continue;
    }

    const items = Array.isArray(incoming) ? incoming : [];
    if (!Array.isArray(incoming)) plan.skipped++;
    const valid: unknown[] = [];
    for (const item of items) {
      const parsed = z.safeParse(entry.item, item);
      if (parsed.success) valid.push(parsed.data);
      else plan.skipped++;
    }
    if (valid.length === 0) continue;
    const keyOf = entry.keyOf as (item: unknown) => string;
    plan.writes.push({ name: entry.name, value: mergeByKey(read(entry.name) as unknown[], valid, keyOf) });
    plan.counts[entry.name] = valid.length;
  }
  return plan;
}

/** Unisce due elenchi per chiave: stesso ordine dei presenti, i nuovi in fondo. */
export function mergeByKey<T>(current: readonly T[], incoming: readonly T[], keyOf: (item: T) => string): T[] {
  const byKey = new Map(incoming.map((item) => [keyOf(item), item]));
  const merged = current.map((item) => {
    const key = keyOf(item);
    const replacement = byKey.get(key);
    if (replacement === undefined) return item;
    byKey.delete(key);
    return replacement;
  });
  return [...merged, ...byKey.values()];
}
