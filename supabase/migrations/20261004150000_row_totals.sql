-- =============================================================================
-- 0008 · Tetto totale di righe per utente e tabella
-- =============================================================================
-- Il limite giornaliero (write_counters) è alto per permettere il primo
-- caricamento di un telefono pieno di dati; giorno dopo giorno, però, un
-- account malintenzionato potrebbe riempire il database. Qui si aggiunge un
-- tetto totale per tabella, molto sopra l'uso reale (decenni di dati).
-- Raggiunto il tetto: errore RL002, i dati restano sul telefono e l'app lo spiega.
-- Si contano solo le righe davvero nuove (come per il limite giornaliero).
-- La futura pulizia delle righe cancellate (pg_cron) dovrà anche abbassare
-- questi contatori.
-- Prova: src/lib/storage/schema.test.ts ("tetto totale").

create table public.row_totals (
  user_id    uuid not null references auth.users (id) on delete cascade,
  table_name text not null,
  count      int not null default 0,
  primary key (user_id, table_name)
);
-- Nessun accesso dal client: la scrive solo il trigger.
revoke all on table public.row_totals from anon, authenticated;
alter table public.row_totals enable row level security;

-- Righe già presenti.
insert into public.row_totals (user_id, table_name, count)
select user_id, 'body_weights', count(*) from public.body_weights group by user_id
union all select user_id, 'brain_results', count(*) from public.brain_results group by user_id
union all select user_id, 'workout_sessions', count(*) from public.workout_sessions group by user_id
union all select user_id, 'food_logs', count(*) from public.food_logs group by user_id
union all select user_id, 'journal_entries', count(*) from public.journal_entries group by user_id
union all select user_id, 'cycle_periods', count(*) from public.cycle_periods group by user_id
union all select user_id, 'cycle_day_logs', count(*) from public.cycle_day_logs group by user_id;

-- Argomenti del trigger: limite giornaliero, tetto totale (facoltativo).
create or replace function public.rate_limit_inserts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day   int;
  v_total int;
begin
  -- Scritture del server (service_role, senza utente): nessun limite.
  if auth.uid() is null then
    return null;
  end if;

  if tg_nargs > 1 then
    insert into public.row_totals (user_id, table_name, count)
    values (auth.uid(), tg_table_name, 1)
    on conflict (user_id, table_name) do update set count = public.row_totals.count + 1
    returning count into v_total;
    if v_total > tg_argv[1]::int then
      -- Definitivo: riprovare domani non serve. L'app lo spiega all'utente.
      raise exception 'Spazio dell''account esaurito per questo tipo di dati.' using errcode = 'RL002';
    end if;
  end if;

  insert into public.write_counters (user_id, table_name, day, count)
  values (auth.uid(), tg_table_name, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, table_name, day) do update set count = public.write_counters.count + 1
  returning count into v_day;
  if v_day > tg_argv[0]::int then
    -- Codice dedicato: l'app lo riconosce, tiene i dati in coda e riprova il giorno dopo.
    raise exception 'Limite giornaliero di registrazioni raggiunto.' using errcode = 'RL001';
  end if;
  return null;
end;
$$;

-- Trigger ricreati con il tetto totale (stessi limiti giornalieri di prima).
drop trigger body_weights_rate_limit on public.body_weights;
create trigger body_weights_rate_limit after insert on public.body_weights
  for each row execute function public.rate_limit_inserts(2000, 40000);
drop trigger brain_results_rate_limit on public.brain_results;
create trigger brain_results_rate_limit after insert on public.brain_results
  for each row execute function public.rate_limit_inserts(10000, 100000);
drop trigger workout_sessions_rate_limit on public.workout_sessions;
create trigger workout_sessions_rate_limit after insert on public.workout_sessions
  for each row execute function public.rate_limit_inserts(10000, 40000);
drop trigger food_logs_rate_limit on public.food_logs;
create trigger food_logs_rate_limit after insert on public.food_logs
  for each row execute function public.rate_limit_inserts(20000, 200000);
drop trigger journal_entries_rate_limit on public.journal_entries;
create trigger journal_entries_rate_limit after insert on public.journal_entries
  for each row execute function public.rate_limit_inserts(2000, 40000);
drop trigger cycle_periods_rate_limit on public.cycle_periods;
create trigger cycle_periods_rate_limit after insert on public.cycle_periods
  for each row execute function public.rate_limit_inserts(2000, 2000);
drop trigger cycle_day_logs_rate_limit on public.cycle_day_logs;
create trigger cycle_day_logs_rate_limit after insert on public.cycle_day_logs
  for each row execute function public.rate_limit_inserts(2000, 40000);

-- Le tabelle future (cibo condiviso, palestra) avranno il tetto da sole.
drop procedure public._setup_synced_table(text, text, int);
create procedure public._setup_synced_table(
  p_table text,
  p_extra text default 'true',
  p_daily_limit int default 10000,
  p_total_limit int default 100000
)
language plpgsql
set search_path = ''
as $$
begin
  execute format('revoke all on table public.%I from anon, authenticated', p_table);
  execute format('grant select on table public.%I to authenticated', p_table);
  execute format('alter table public.%I enable row level security', p_table);

  execute format(
    'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()) and %s)',
    p_table || '_select_own', p_table, p_extra);
  execute format(
    'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()) and %s)',
    p_table || '_insert_own', p_table, p_extra);
  execute format(
    'create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid()) and %s) with check (user_id = (select auth.uid()) and %s)',
    p_table || '_update_own', p_table, p_extra, p_extra);

  execute format(
    'create trigger %I before insert or update on public.%I for each row execute function public.sync_guard()',
    p_table || '_sync_guard', p_table);
  execute format(
    'create trigger %I after insert on public.%I for each row execute function public.rate_limit_inserts(%s, %s)',
    p_table || '_rate_limit', p_table, p_daily_limit, p_total_limit);
  execute format(
    'create index %I on public.%I (user_id, server_updated_at)',
    p_table || '_sync_idx', p_table);
end;
$$;
revoke execute on procedure public._setup_synced_table(text, text, int, int) from public, anon, authenticated;
