-- =============================================================================
-- 0005 · Export dei dati, testo svuotato nelle righe cancellate, chiusura
-- =============================================================================
-- =============================================================================
-- PARTE 6 · Export, pulizia, chiusura
-- =============================================================================

-- Export completo dei propri dati (JSON). Include il ciclo anche se la sezione
-- è spenta: sono comunque dati dell'utente. Il CSV si genera nell'app da questo JSON.
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'body_weights', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id'), '[]') from public.body_weights t where t.user_id = auth.uid() and t.deleted_at is null),
    'brain_results', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id'), '[]') from public.brain_results t where t.user_id = auth.uid() and t.deleted_at is null),
    'workout_sessions', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id'), '[]') from public.workout_sessions t where t.user_id = auth.uid() and t.deleted_at is null),
    'food_logs', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id'), '[]') from public.food_logs t where t.user_id = auth.uid() and t.deleted_at is null),
    'journal_entries', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' - 'search'), '[]') from public.journal_entries t where t.user_id = auth.uid() and t.deleted_at is null),
    'health_consents', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id'), '[]') from public.health_consents t where t.user_id = auth.uid()),
    'cycle_periods', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id'), '[]') from public.cycle_periods t where t.user_id = auth.uid() and t.deleted_at is null),
    'cycle_day_logs', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id'), '[]') from public.cycle_day_logs t where t.user_id = auth.uid() and t.deleted_at is null)
  );
$$;

-- Testo libero svuotato quando una riga viene cancellata (resta solo il "segnale").
create or replace function public.scrub_deleted_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    if tg_table_name = 'journal_entries' then
      new.content := '';
    elsif tg_table_name = 'cycle_day_logs' then
      new.notes := '';
    elsif tg_table_name = 'workout_sessions' then
      new.notes := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger journal_entries_scrub before insert or update on public.journal_entries
  for each row execute function public.scrub_deleted_text();
create trigger cycle_day_logs_scrub before insert or update on public.cycle_day_logs
  for each row execute function public.scrub_deleted_text();
create trigger workout_sessions_scrub before insert or update on public.workout_sessions
  for each row execute function public.scrub_deleted_text();

-- Pulizia (con pg_cron, una volta al mese): le righe cancellate da più di 180
-- giorni spariscono davvero. Un telefono rimasto offline più a lungo rifà un
-- download completo invece di quello incrementale.
--   select cron.schedule('purge-tombstones', '0 4 1 * *', $$
--     delete from public.food_logs where deleted_at < now() - interval '180 days';
--     ... (stessa riga per ogni tabella sincronizzata)
--   $$);

revoke execute on function public.can_use_cycle() from public, anon;
revoke execute on function public.grant_cycle_consent(text) from public, anon;
revoke execute on function public.set_cycle_tracking(boolean) from public, anon;
revoke execute on function public.delete_cycle_data() from public, anon;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.can_use_cycle() to authenticated;
grant execute on function public.grant_cycle_consent(text) to authenticated;
grant execute on function public.set_cycle_tracking(boolean) to authenticated;
grant execute on function public.delete_cycle_data() to authenticated;
grant execute on function public.export_my_data() to authenticated;

-- La procedura di servizio resta per le migrazioni future (cibo condiviso,
-- palestra), ma nessun client può eseguirla.
revoke execute on procedure public._setup_synced_table(text, text, int) from public, anon, authenticated;

-- Fase D (solo schema di massima): exercises (catalogo + personalizzati,
-- muscolo, attrezzo, tipo: carichi / corpo libero / a tempo / cardio),
-- routines + routine_exercises (ordine, superset), workout_sets (tipo di serie,
-- reps, kg, secondi, distanza, RPE/RIR, nota; FK composta sessione+utente),
-- body_measurements (circonferenze, una riga al giorno). Le foto dei progressi
-- NON hanno tabelle: restano solo sul telefono.
