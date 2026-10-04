import type { BrainResult } from "@/lib/brain/history";
import type { Workout } from "@/lib/health/workouts";
import type { BodyWeight } from "@/lib/profile/profile";

// Come un elenco locale diventa una tabella del database e viceversa.
// I nomi delle colonne sono quelli di supabase/migrations/. Le colonne
// user_id e server_updated_at le scrive il server, mai il telefono.

export type Row = Record<string, unknown> & {
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  server_updated_at?: string;
};

export type SyncTable<T> = {
  /** Nome dell'elenco locale (definitions.ts). */
  collection: string;
  /** Nome della tabella nel database. */
  table: string;
  /** Colonna che identifica la riga per l'utente (id o giorno). */
  keyColumn: string;
  /** Colonne per l'upsert ("on conflict"). */
  conflict: string;
  toRow(item: T): Record<string, unknown>;
  fromRow(row: Row): T;
  /** Data di creazione da usare nel cloud (se l'elemento ne ha una sua). */
  createdAt?(item: T): string | undefined;
};

const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));

export const bodyWeightsTable: SyncTable<BodyWeight> = {
  collection: "body-weights",
  table: "body_weights",
  keyColumn: "measured_on",
  conflict: "user_id,measured_on",
  toRow: (w) => ({ measured_on: w.day, weight_kg: w.kg }),
  fromRow: (r) => ({ day: String(r.measured_on), kg: Number(r.weight_kg) }),
};

export const brainResultsTable: SyncTable<BrainResult> = {
  collection: "brain-results",
  table: "brain_results",
  keyColumn: "id",
  conflict: "id",
  toRow: (b) => ({
    id: b.id,
    game: b.game,
    variant: b.variant,
    played_at: b.at,
    played_on: b.day,
    score: b.score,
    metrics: b.metrics,
    routine: b.routine,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    game: r.game as BrainResult["game"],
    variant: String(r.variant),
    at: new Date(String(r.played_at)).toISOString(),
    day: String(r.played_on),
    score: Number(r.score),
    metrics: (r.metrics ?? {}) as Record<string, number>,
    routine: Boolean(r.routine),
  }),
};

export const workoutsTable: SyncTable<Workout> = {
  collection: "workouts",
  table: "workout_sessions",
  keyColumn: "id",
  conflict: "id",
  toRow: (w) => ({
    id: w.id,
    performed_on: w.day,
    activity_type: w.type,
    duration_min: w.minutes,
    intensity: w.intensity,
    notes: w.note ?? null,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    day: String(r.performed_on),
    // L'ora di registrazione del telefono viaggia come created_at.
    at: new Date(String(r.created_at)).toISOString(),
    type: r.activity_type as Workout["type"],
    minutes: num(r.duration_min)!,
    intensity: num(r.intensity) as Workout["intensity"],
    ...(r.notes ? { note: String(r.notes) } : {}),
  }),
  createdAt: (w) => w.at,
};

/** Tabelle sincronizzate, nell'ordine in cui si inviano. */
export const SYNC_TABLES: readonly SyncTable<never>[] = [bodyWeightsTable, brainResultsTable, workoutsTable] as SyncTable<never>[];
