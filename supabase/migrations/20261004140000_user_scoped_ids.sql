-- =============================================================================
-- 0007 · Id per utente e limite giornaliero solo per i telefoni
-- =============================================================================
-- 1) La chiave delle righe con id diventa (user_id, id) invece del solo id.
--    Con l'id da solo, se due account avevano righe con lo stesso id (stesso
--    telefono passato a un altro account con "usa i dati di questo telefono",
--    o la stessa copia di sicurezza importata in due account), l'invio del
--    secondo veniva rifiutato dalla RLS per sempre e la sua sincronizzazione
--    restava bloccata. I dati del primo erano comunque protetti; ora ogni
--    account ha i suoi id, senza interferenze.
--    Il telefono invia con on_conflict = user_id,id (src/lib/sync/tables.ts).
-- Prova: src/lib/storage/schema.test.ts ("stesso id in due account").

alter table public.brain_results drop constraint brain_results_pkey;
alter table public.brain_results add primary key (user_id, id);

alter table public.workout_sessions drop constraint workout_sessions_pkey;
alter table public.workout_sessions add primary key (user_id, id);

alter table public.food_logs drop constraint food_logs_pkey;
alter table public.food_logs add primary key (user_id, id);

alter table public.cycle_periods drop constraint cycle_periods_pkey;
alter table public.cycle_periods add primary key (user_id, id);

-- 2) Il limite giornaliero vale per gli utenti (auth.uid()). Le scritture del
--    server (service_role, senza utente) non si contano: prima fallivano perché
--    il contatore non può avere user_id vuoto.
create or replace function public.rate_limit_inserts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    return null;
  end if;
  insert into public.write_counters (user_id, table_name, day, count)
  values (auth.uid(), tg_table_name, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, table_name, day) do update set count = public.write_counters.count + 1
  returning count into v_count;
  if v_count > tg_argv[0]::int then
    -- Codice dedicato: l'app lo riconosce, tiene i dati in coda e riprova il giorno dopo.
    raise exception 'Limite giornaliero di registrazioni raggiunto.' using errcode = 'RL001';
  end if;
  return null;
end;
$$;
