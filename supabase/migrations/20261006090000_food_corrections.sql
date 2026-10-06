-- =============================================================================
-- 0010 · Correzioni degli alimenti dalla comunità ("stile Wikipedia")
-- =============================================================================
-- Deciso con l'utente il 5/10/2026: chi ha un account con email verificata può
-- proporre i valori giusti (per 100 g/ml) di un alimento della tabella inclusa
-- nell'app (src/lib/health/catalog/foods.ts). Le proposte di tutti si
-- raccolgono e, da MIN_VOTES persone in su, l'app usa la mediana di ogni valore:
-- una media che un singolo valore assurdo non riesce a spostare.
--
-- Sono dati condivisi, non personali, e quindi NON cifrati: il gestore vede
-- alimento e valori. Chi li ha mandati invece non è scritto da nessuna parte:
-- al posto dell'account c'è un'impronta (sha256 dell'id con una chiave segreta
-- del database), che serve solo a contare un voto per persona per alimento.
-- Il telefono non legge mai le singole proposte: solo la mediana.
-- Tutto passa da funzioni (security definer): nessun permesso diretto sulle tabelle.

-- Chiave segreta per le impronte: una riga sola, illeggibile dai client.
create table public.food_secret (
  id     boolean primary key default true check (id),
  secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
insert into public.food_secret default values;
alter table public.food_secret enable row level security;
revoke all on table public.food_secret from anon, authenticated;

create table public.food_corrections (
  food_id    text not null check (food_id ~ '^[a-z0-9-]{1,64}$'),
  voter      text not null check (voter ~ '^[0-9a-f]{64}$'),
  kcal       numeric(5, 1) not null check (kcal between 0 and 900),
  protein    numeric(4, 1) not null check (protein between 0 and 100),
  carbs      numeric(4, 1) not null check (carbs between 0 and 100),
  fat        numeric(4, 1) not null check (fat between 0 and 100),
  -- Solo il giorno: niente orari precisi da incrociare con altro.
  updated_on date not null default current_date,
  primary key (food_id, voter),
  check (protein + carbs + fat <= 100),
  -- Stessa regola dell'app (kcalConsistent): kcal entro il 20% (o 10 kcal) di
  -- quelle calcolate dai macro. Ferma i valori a caso.
  check (abs(kcal - (4 * protein + 4 * carbs + 9 * fat)) <= greatest(0.2 * (4 * protein + 4 * carbs + 9 * fat), 10))
);
alter table public.food_corrections enable row level security;
revoke all on table public.food_corrections from anon, authenticated;

-- Impronta dell'account che vota (mai salvata insieme all'id).
create or replace function public._food_voter(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(sha256(convert_to((select s.secret from public.food_secret s) || ':' || p_user::text, 'UTF8')), 'hex');
$$;
revoke execute on function public._food_voter(uuid) from public, anon, authenticated;

-- Manda (o aggiorna) la propria correzione per un alimento.
-- Errori: FC001 senza account, FC002 email non verificata, RL001 limite del giorno (30).
create or replace function public.submit_food_correction(
  p_food_id text,
  p_kcal numeric,
  p_protein numeric,
  p_carbs numeric,
  p_fat numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'Serve un account.' using errcode = 'FC001';
  end if;
  if not exists (select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null) then
    raise exception 'Serve un account con email verificata.' using errcode = 'FC002';
  end if;
  -- Stesso contatore giornaliero delle altre scritture (conta i voti, non quali alimenti).
  insert into public.write_counters (user_id, table_name, day, count)
  values (v_uid, 'food_corrections', (now() at time zone 'utc')::date, 1)
  on conflict (user_id, table_name, day) do update set count = public.write_counters.count + 1
  returning count into v_count;
  if v_count > 30 then
    raise exception 'Limite giornaliero di correzioni raggiunto.' using errcode = 'RL001';
  end if;

  insert into public.food_corrections (food_id, voter, kcal, protein, carbs, fat)
  values (p_food_id, public._food_voter(v_uid), round(p_kcal, 1), round(p_protein, 1), round(p_carbs, 1), round(p_fat, 1))
  on conflict (food_id, voter) do update
    set kcal = excluded.kcal, protein = excluded.protein, carbs = excluded.carbs, fat = excluded.fat,
        updated_on = current_date;
end;
$$;
revoke execute on function public.submit_food_correction(text, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.submit_food_correction(text, numeric, numeric, numeric, numeric) to authenticated;

-- Ritira le proprie correzioni (tutte, o di un alimento): per la privacy e per
-- la futura cancellazione dell'account, che deve chiamarla prima.
create or replace function public.withdraw_food_corrections(p_food_id text default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_deleted int;
begin
  if v_uid is null then
    raise exception 'Serve un account.' using errcode = 'FC001';
  end if;
  delete from public.food_corrections c
  where c.voter = public._food_voter(v_uid) and (p_food_id is null or c.food_id = p_food_id);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
revoke execute on function public.withdraw_food_corrections(text) from public, anon;
grant execute on function public.withdraw_food_corrections(text) to authenticated;

-- Valori della comunità: mediana di ogni valore, solo per gli alimenti con
-- almeno 5 persone (MIN_VOTES, uguale nell'app). Nessuna proposta singola esce.
create or replace function public.food_consensus()
returns table (food_id text, votes int, kcal numeric, protein numeric, carbs numeric, fat numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select c.food_id,
         count(*)::int,
         round(percentile_cont(0.5) within group (order by c.kcal)::numeric, 1),
         round(percentile_cont(0.5) within group (order by c.protein)::numeric, 1),
         round(percentile_cont(0.5) within group (order by c.carbs)::numeric, 1),
         round(percentile_cont(0.5) within group (order by c.fat)::numeric, 1)
  from public.food_corrections c
  group by c.food_id
  having count(*) >= 5;
$$;
revoke execute on function public.food_consensus() from public, anon;
grant execute on function public.food_consensus() to authenticated;
