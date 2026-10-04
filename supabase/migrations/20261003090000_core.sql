-- =============================================================================
-- 0001 · Core: utilità, profili, peso corporeo
-- =============================================================================
-- Convenzioni valide per tutte le migrazioni:
--  * ogni tabella privata ha `user_id uuid default auth.uid()` → auth.users con
--    ON DELETE CASCADE, RLS attiva e policy "solo il proprietario";
--  * il client NON scrive mai `user_id`: è riempito dal default auth.uid() e i
--    privilegi a livello di colonna non lo includono;
--  * su ogni tabella si parte da `revoke all` e si concede solo il necessario
--    (Supabase di default concede tutto ad anon/authenticated);
--  * le funzioni SECURITY DEFINER hanno sempre `set search_path = ''`.
-- Documentazione completa: docs/SCHEMA.md
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Utilità
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Età in anni compiuti conoscendo solo mese e anno di nascita.
-- Prudente: durante il mese del compleanno si considera il compleanno non
-- ancora passato (così nessuno risulta più grande di quanto sia).
-- Stessa logica in src/lib/age.ts (con test).
create or replace function public.age_from_birth(
  p_year int,
  p_month int,
  p_today date default current_date
)
returns int
language sql
stable
set search_path = ''
as $$
  select case
    when p_year is null or p_month is null then null
    else extract(year from p_today)::int - p_year
         - case when extract(month from p_today)::int <= p_month then 1 else 0 end
  end;
$$;

-- Versione corrente del disclaimer. Cambiarla (con una nuova migrazione)
-- obbliga tutti a riaccettarlo. Deve coincidere con DISCLAIMER_VERSION in
-- src/lib/legal.ts.
create or replace function public.current_disclaimer_version()
returns text
language sql
immutable
set search_path = ''
as $$
  select '2026-10-03'::text;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

create table public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  display_name            text check (char_length(display_name) <= 50),
  sex                     text check (sex in ('female', 'male')),
  height_cm               numeric(4, 1) check (height_cm between 100 and 250),
  birth_year              smallint check (birth_year between 1900 and 2100),
  birth_month             smallint check (birth_month between 1 and 12),
  activity_level          text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal                    text check (goal in ('lose', 'maintain', 'gain')),
  kcal_goal               int check (kcal_goal between 800 and 6000),
  protein_goal_g          int check (protein_goal_g between 20 and 400),
  goals_source            text not null default 'auto' check (goals_source in ('auto', 'manual')),
  goals_weight_kg         numeric(5, 2) check (goals_weight_kg between 25 and 400),
  disclaimer_version      text,
  disclaimer_accepted_at  timestamptz,
  onboarding_completed_at timestamptz,
  timezone                text not null default 'Europe/Rome' check (char_length(timezone) <= 64),
  plan                    text not null default 'free' check (plan in ('free', 'pro')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.profiles is 'Un profilo per utente, creato dal trigger su auth.users.';
comment on column public.profiles.plan is 'Piano (free/pro). Non modificabile dal client: lo cambierà il futuro webhook di pagamento.';
comment on column public.profiles.goals_weight_kg is 'Peso usato per l''ultimo calcolo automatico degli obiettivi (per proporre il ricalcolo a ±2 kg).';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Regole che il client non può aggirare:
--  * età minima 14 anni;
--  * data di nascita non modificabile una volta inserita;
--  * sotto i 18 anni niente obiettivo "dimagrire" né obiettivo calorico.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_age int;
begin
  if tg_op = 'UPDATE'
     and old.birth_year is not null
     and (new.birth_year is distinct from old.birth_year
          or new.birth_month is distinct from old.birth_month) then
    raise exception 'La data di nascita non si può modificare dopo averla inserita.'
      using errcode = 'P0001';
  end if;

  v_age := public.age_from_birth(new.birth_year, new.birth_month);

  if v_age is not null and v_age < 14 then
    raise exception 'Per usare l''app devi avere almeno 14 anni.'
      using errcode = 'P0001';
  end if;

  if v_age is not null and v_age < 18 then
    if new.goal = 'lose' then
      raise exception 'Sotto i 18 anni l''obiettivo "dimagrire" non è disponibile.'
        using errcode = 'P0001';
    end if;
    new.kcal_goal := null;
  end if;

  return new;
end;
$$;

create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- Profilo creato in automatico alla registrazione.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Privilegi: lettura + modifica solo di alcune colonne. Niente insert/delete
-- dal client (il profilo nasce col trigger e muore con l'account).
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (
  display_name, sex, height_cm, birth_year, birth_month, activity_level, goal,
  kcal_goal, protein_goal_g, goals_source, goals_weight_kg, timezone
) on table public.profiles to authenticated;

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- body_weights: storico del peso
-- -----------------------------------------------------------------------------

create table public.body_weights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg   numeric(5, 2) not null check (weight_kg between 25 and 400),
  created_at  timestamptz not null default now(),
  unique (user_id, measured_on)
);

revoke all on table public.body_weights from anon, authenticated;
grant select, delete on table public.body_weights to authenticated;
grant insert (measured_on, weight_kg) on table public.body_weights to authenticated;
grant update (measured_on, weight_kg) on table public.body_weights to authenticated;

alter table public.body_weights enable row level security;

create policy "body_weights_select_own" on public.body_weights
  for select to authenticated using (user_id = (select auth.uid()));
create policy "body_weights_insert_own" on public.body_weights
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "body_weights_update_own" on public.body_weights
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "body_weights_delete_own" on public.body_weights
  for delete to authenticated using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Funzioni chiamabili dal client (RPC)
-- -----------------------------------------------------------------------------

-- Accettazione del disclaimer: data/ora le mette il server, non il client.
create or replace function public.accept_disclaimer(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Non autenticato.' using errcode = '42501';
  end if;
  if p_version is distinct from public.current_disclaimer_version() then
    raise exception 'Versione del disclaimer non valida.' using errcode = 'P0001';
  end if;
  update public.profiles
     set disclaimer_version = p_version,
         disclaimer_accepted_at = now()
   where id = auth.uid();
end;
$$;

-- Chiude l'onboarding solo se i dati obbligatori ci sono davvero.
create or replace function public.complete_onboarding()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.profiles;
  v_age int;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profilo non trovato.' using errcode = 'P0001';
  end if;
  if p.disclaimer_accepted_at is null
     or p.disclaimer_version is distinct from public.current_disclaimer_version() then
    raise exception 'Devi prima accettare l''avviso.' using errcode = 'P0001';
  end if;
  if p.sex is null or p.height_cm is null or p.birth_year is null or p.birth_month is null
     or p.activity_level is null or p.goal is null or p.protein_goal_g is null then
    raise exception 'Dati del profilo incompleti.' using errcode = 'P0001';
  end if;
  v_age := public.age_from_birth(p.birth_year, p.birth_month);
  if v_age >= 18 and p.kcal_goal is null then
    raise exception 'Manca l''obiettivo calorico.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.body_weights where user_id = auth.uid()) then
    raise exception 'Manca il peso iniziale.' using errcode = 'P0001';
  end if;
  update public.profiles
     set onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where id = auth.uid();
end;
$$;

-- Maggiorenne? Usata dalle policy del modulo ciclo (disattivato sotto i 18).
create or replace function public.current_user_is_adult()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.age_from_birth(birth_year, birth_month) >= 18
       from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke execute on function public.accept_disclaimer(text) from public, anon;
revoke execute on function public.complete_onboarding() from public, anon;
revoke execute on function public.current_user_is_adult() from public, anon;
grant execute on function public.accept_disclaimer(text) to authenticated;
grant execute on function public.complete_onboarding() to authenticated;
grant execute on function public.current_user_is_adult() to authenticated;
