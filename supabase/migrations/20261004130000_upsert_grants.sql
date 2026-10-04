-- =============================================================================
-- 0006 · Permessi per l'invio dal telefono ("inserisci o aggiorna")
-- =============================================================================
-- Il telefono invia con un upsert: "insert ... on conflict (...) do update set"
-- su TUTTE le colonne inviate, comprese la chiave (id o giorno) e created_at.
-- Postgres chiede il permesso di UPDATE su ciascuna, anche se il valore non
-- cambia. Non è un rischio:
--  * la chiave in conflitto ha per forza lo stesso valore;
--  * created_at lo rimette com'era sync_guard (non si può riscrivere);
--  * la RLS limita tutto alle righe dell'utente.
-- Prova: src/lib/storage/schema.test.ts ("upsert come lo fa il telefono").

grant update (measured_on, created_at) on table public.body_weights to authenticated;

grant update (id, game, variant, played_at, played_on, score, metrics, routine, created_at)
  on table public.brain_results to authenticated;

grant update (id, created_at) on table public.workout_sessions to authenticated;
grant update (id, created_at) on table public.food_logs to authenticated;
grant update (entry_date, created_at) on table public.journal_entries to authenticated;
grant update (id, created_at) on table public.cycle_periods to authenticated;
grant update (log_date, created_at) on table public.cycle_day_logs to authenticated;
