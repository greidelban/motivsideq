-- =============================================================================
-- 0004 · Ciclo (dati sanitari, art. 9 GDPR)
-- =============================================================================
-- =============================================================================
-- PARTE 5 · Ciclo (dati sanitari, art. 9 GDPR)
-- =============================================================================
-- Accesso solo se TUTTO è vero: proprietario dei dati, sex = 'female',
-- maggiorenne, cycle_tracking_enabled, consenso attivo sulla versione corrente
-- dell'informativa. Nessuna vista o statistica aggregata legge queste tabelle,
-- e non ci sono analytics.

create table public.health_consents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope          text not null check (scope = 'cycle'),
  policy_version text not null,
  granted_at     timestamptz not null default now(),
  revoked_at     timestamptz
);
create unique index health_consents_one_active on public.health_consents (user_id, scope) where revoked_at is null;

-- Il client può solo leggere i propri consensi: scrivono le funzioni qui sotto.
revoke all on table public.health_consents from anon, authenticated;
grant select on table public.health_consents to authenticated;
alter table public.health_consents enable row level security;
create policy "health_consents_select_own" on public.health_consents
  for select to authenticated using (user_id = (select auth.uid()));

-- L'unico punto che decide l'accesso al Ciclo nel database
-- (gemello di canUseCycle(profile) nell'app).
create or replace function public.can_use_cycle()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.sex = 'female'
       and p.cycle_tracking_enabled
       and public.age_from_birth(p.birth_year, p.birth_month) >= 18
      from public.profiles p
     where p.id = auth.uid()
  ), false)
  and exists (
    select 1 from public.health_consents c
     where c.user_id = auth.uid() and c.scope = 'cycle' and c.revoked_at is null
       and c.policy_version = public.current_cycle_policy_version()
  );
$$;

create table public.cycle_periods (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_date        date not null check (start_date >= '1900-01-01'),
  end_date          date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  check (end_date is null or (end_date >= start_date and end_date - start_date < 15))
);
-- Due inizi uguali non sono ammessi (tra le righe non cancellate). Se due
-- telefoni offline segnano lo stesso inizio, la sincronizzazione unisce le due righe.
create unique index cycle_periods_one_start on public.cycle_periods (user_id, start_date) where deleted_at is null;

-- Registro del giorno. Umore, energia e fame NON stanno qui: sono nel check-in.
create table public.cycle_day_logs (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date          date not null check (log_date >= '1900-01-01'),
  flow              text check (flow in ('spotting', 'light', 'medium', 'heavy')),
  symptoms          text[] not null default '{}' check (
    cardinality(symptoms) <= 30 and symptoms <@ array[
      'cramps', 'headache', 'bloating', 'fatigue', 'moodSwings', 'acne', 'breastTenderness', 'cravings',
      'backPain', 'nausea', 'insomnia', 'ovulationPain', 'diarrhea', 'constipation', 'dizziness', 'hotFlashes'
    ]::text[]),
  cervical_mucus    text check (cervical_mucus in ('dry', 'sticky', 'creamy', 'watery', 'eggWhite')),
  -- Priorità media della fase B (tutti facoltativi). Rapporti, protezione e
  -- pillola NON sono qui: restano solo sul telefono e non si sincronizzano
  -- (se un giorno serviranno nel cloud: scelta separata con un consenso a parte).
  bbt_celsius       numeric(4, 2) check (bbt_celsius between 34 and 42),
  lh_test           text check (lh_test in ('negative', 'positive')),
  pregnancy_test    text check (pregnancy_test in ('negative', 'positive')),
  notes             text not null default '' check (char_length(notes) <= 1000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

call public._setup_synced_table('cycle_periods', '(select public.can_use_cycle())', 2000);
call public._setup_synced_table('cycle_day_logs', '(select public.can_use_cycle())', 2000);

grant insert (id, start_date, end_date, created_at, updated_at, deleted_at) on table public.cycle_periods to authenticated;
grant update (start_date, end_date, updated_at, deleted_at) on table public.cycle_periods to authenticated;
grant insert (log_date, flow, symptoms, cervical_mucus, bbt_celsius, lh_test, pregnancy_test,
              notes, created_at, updated_at, deleted_at)
  on table public.cycle_day_logs to authenticated;
grant update (flow, symptoms, cervical_mucus, bbt_celsius, lh_test, pregnancy_test,
              notes, updated_at, deleted_at)
  on table public.cycle_day_logs to authenticated;

-- Dopo una cancellazione totale, righe vecchie da un telefono rimasto offline
-- non devono far "risorgere" i dati.
create or replace function public.cycle_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_wiped timestamptz;
begin
  select cycle_wiped_at into v_wiped from public.profiles where id = auth.uid();
  if v_wiped is not null and new.updated_at <= v_wiped then
    return null;
  end if;
  return new;
end;
$$;

create trigger cycle_periods_guard before insert or update on public.cycle_periods
  for each row execute function public.cycle_guard();
create trigger cycle_day_logs_guard before insert or update on public.cycle_day_logs
  for each row execute function public.cycle_guard();

-- Consenso esplicito (con versione dell'informativa) e attivazione del Ciclo.
create or replace function public.grant_cycle_consent(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Non autenticato.' using errcode = '42501';
  end if;
  if p_version is distinct from public.current_cycle_policy_version() then
    raise exception 'Versione dell''informativa non valida.' using errcode = 'P0001';
  end if;
  if p.sex is distinct from 'female' or coalesce(public.age_from_birth(p.birth_year, p.birth_month), 0) < 18 then
    raise exception 'Il monitoraggio del ciclo non è disponibile per questo profilo.' using errcode = 'P0001';
  end if;
  update public.health_consents set revoked_at = now()
   where user_id = auth.uid() and scope = 'cycle' and revoked_at is null;
  insert into public.health_consents (user_id, scope, policy_version) values (auth.uid(), 'cycle', p_version);
  update public.profiles set cycle_tracking_enabled = true where id = auth.uid();
end;
$$;

-- Spegne o riaccende la sezione senza toccare i dati (es. dopo aver cambiato il
-- sesso e scelto di conservarli). Riaccendere richiede comunque le condizioni.
create or replace function public.set_cycle_tracking(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set cycle_tracking_enabled = p_enabled where id = auth.uid();
  -- profiles_guard lo rimette a false se sesso o età non lo permettono.
end;
$$;

-- Cancellazione totale con un tasto: dati cancellati davvero, consenso
-- revocato, sezione spenta.
create or replace function public.delete_cycle_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Non autenticato.' using errcode = '42501';
  end if;
  delete from public.cycle_day_logs where user_id = auth.uid();
  delete from public.cycle_periods where user_id = auth.uid();
  update public.health_consents set revoked_at = now()
   where user_id = auth.uid() and scope = 'cycle' and revoked_at is null;
  update public.profiles set cycle_tracking_enabled = false, cycle_wiped_at = now() where id = auth.uid();
end;
$$;


