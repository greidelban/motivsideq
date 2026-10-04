-- =============================================================================
-- 0001 · Core: utilità, regole di sincronizzazione, profili, peso corporeo
-- =============================================================================
-- Convenzioni valide per tutte le migrazioni:
--  * ogni tabella privata ha `user_id uuid default auth.uid()` → auth.users con
--    ON DELETE CASCADE, RLS attiva e policy "solo il proprietario";
--  * il client NON scrive mai `user_id`: è riempito dal default auth.uid() e i
--    privilegi a livello di colonna non lo includono;
--  * su ogni tabella si parte da `revoke all` e si concede solo il necessario
--    (Supabase di default concede tutto ad anon/authenticated);
--  * le funzioni SECURITY DEFINER hanno sempre `set search_path = ''`;
--  * le tabelle sincronizzate seguono le regole della Parte 0 (sotto).
-- Documentazione: docs/SCHEMA.md · prova: src/lib/storage/schema.test.ts
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

-- =============================================================================
-- PARTE 0 · Regole comuni di sincronizzazione
-- =============================================================================
-- Ogni riga privata ha:
--   id                → UUID generato sul telefono (crypto.randomUUID), così i
--                        dati creati offline o prima dell'account si caricano
--                        senza conflitti;
--   created_at         → quando è nata sul telefono;
--   updated_at         → ultima modifica sul telefono: decide i conflitti
--                        (vince la modifica più recente);
--   deleted_at         → cancellazione "morbida": la riga resta come segnale per
--                        gli altri dispositivi (il testo libero viene svuotato);
--   server_updated_at  → scritto SOLO dal server: il telefono scarica "tutto ciò
--                        che è cambiato dopo l'ultima volta" in base a questo.
--
-- Le righe "una al giorno" (peso, check-in/diario, registro del ciclo) non
-- hanno id: la chiave è (user_id, giorno). Così due telefoni offline che
-- scrivono lo stesso giorno finiscono sulla stessa riga invece di duplicarla.
--
-- Giorni: ogni colonna "giorno" (date) la calcola il telefono nel fuso
-- dell'utente. Il server non usa mai current_date (che sarebbe in UTC): per
-- questo nessuna colonna giorno ha un default.
--
-- Unità: sempre metriche (kg, cm, ml, °C). kg/lb è solo una preferenza
-- dell'interfaccia (profiles.weight_unit).
--
-- Il client non cancella mai davvero (niente privilegio DELETE): imposta
-- deleted_at. Le cancellazioni vere avvengono solo con la cancellazione
-- dell'account (cascata), con delete_cycle_data() e con la pulizia periodica.

-- Vince l'ultima modifica; orologi sbagliati non possono "vincere per sempre".
create or replace function public.sync_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Un telefono con l'orologio avanti non può scrivere date nel futuro.
  if new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;

  if tg_op = 'INSERT' then
    if new.created_at > now() + interval '5 minutes' then
      new.created_at := now();
    end if;
  else
    -- Versione più vecchia di quella salvata: ignorata in silenzio (la risposta
    -- del server non la contiene, e al prossimo download il telefono riceve
    -- quella giusta).
    if new.updated_at < old.updated_at then
      return null;
    end if;
    new.created_at := old.created_at;
  end if;

  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- Limite di nuove righe per utente, tabella e giorno (UTC), contro gli abusi.
-- Un contatore invece di contare le righe: resta veloce anche quando il primo
-- caricamento dal telefono porta migliaia di righe.
create table public.write_counters (
  user_id    uuid not null references auth.users (id) on delete cascade,
  table_name text not null,
  day        date not null,
  count      int not null default 0,
  primary key (user_id, table_name, day)
);
-- Nessun accesso dal client: la scrive solo il trigger qui sotto.
revoke all on table public.write_counters from anon, authenticated;
alter table public.write_counters enable row level security;

-- Uso: trigger "AFTER insert" con il limite giornaliero come argomento.
-- Conta solo le righe davvero nuove: in un "insert ... on conflict do update"
-- le righe già presenti passano dai trigger di UPDATE, non da questo. Così un
-- invio fallito a metà e ritentato non consuma il limite due volte (e se fallisce,
-- l'aumento del contatore viene annullato insieme al resto della transazione).
create or replace function public.rate_limit_inserts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
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

-- Imposta una tabella sincronizzata: privilegi minimi, RLS "solo il
-- proprietario" (più una condizione extra, es. per il ciclo), trigger di
-- sincronizzazione, indice per il download incrementale.
-- Usata solo dentro le migrazioni e cancellata alla fine (Parte 6).
-- I trigger "before" di una riga scattano in ordine alfabetico: *_guard (ciclo),
-- *_scrub, *_sync_guard; *_rate_limit scatta dopo l'inserimento.
create or replace procedure public._setup_synced_table(
  p_table text,
  p_extra text default 'true',
  p_daily_limit int default 10000
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
    'create trigger %I after insert on public.%I for each row execute function public.rate_limit_inserts(%s)',
    p_table || '_rate_limit', p_table, p_daily_limit);
  execute format(
    'create index %I on public.%I (user_id, server_updated_at)',
    p_table || '_sync_idx', p_table);
end;
$$;



-- =============================================================================
-- PARTE 1 · Core rivista: profiles e body_weights
-- =============================================================================

-- Versione dell'informativa sul ciclo: cambiandola, tutti devono ridare il
-- consenso. Deve coincidere con CYCLE_POLICY_VERSION in src/lib/legal.ts.
create or replace function public.current_cycle_policy_version()
returns text
language sql
immutable
set search_path = ''
as $$
  select '2026-10-04'::text;
$$;

create table public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  -- Nome mostrato nel saluto: lo vede solo l'utente (max 16, come NAME_MAX nell'app).
  display_name            text check (char_length(display_name) <= 16),
  -- Serve alla formula del metabolismo e decide se il Ciclo esiste (vedi can_use_cycle).
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
  -- NUOVO: preferenza dell'interfaccia; i dati restano in kg.
  weight_unit             text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  -- NUOVO: separato dal sesso, così in futuro si può estendere senza cambiare
  -- lo schema. Oggi può essere true solo se sex = 'female' e maggiorenne.
  -- Il client non lo scrive: passa da grant_cycle_consent() / set_cycle_tracking().
  cycle_tracking_enabled  boolean not null default false,
  -- NUOVO: momento dell'ultima cancellazione totale dei dati del ciclo; righe
  -- più vecchie in arrivo da un telefono rimasto offline vengono scartate.
  cycle_wiped_at          timestamptz,
  disclaimer_version      text,
  disclaimer_accepted_at  timestamptz,
  onboarding_completed_at timestamptz,
  -- Fuso del dispositivo, aggiornato dal telefono (es. in viaggio).
  timezone                text not null default 'Europe/Rome' check (char_length(timezone) <= 64),
  plan                    text not null default 'free' check (plan in ('free', 'pro')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  server_updated_at       timestamptz not null default now()
);

comment on column public.profiles.plan is 'Piano (free/pro). Non modificabile dal client: lo cambierà il futuro webhook di pagamento.';
comment on column public.profiles.cycle_tracking_enabled is 'Accesso al Ciclo. Scritto solo dalle funzioni del consenso; spento in automatico se il sesso non è più female.';

create trigger profiles_sync_guard
  before update on public.profiles
  for each row execute function public.sync_guard();

-- Regole che il client non può aggirare:
--  * età minima 14 anni;
--  * la data di nascita SI PUÒ correggere (un errore di battitura deve avere
--    rimedio, e l'età è comunque dichiarata): per questo le regole sull'età si
--    ricalcolano a ogni scrittura dalla data attuale, e can_use_cycle() la
--    ricalcola a ogni lettura;
--  * sotto i 18 anni niente "dimagrire" né obiettivo calorico: si correggono
--    in silenzio (un errore bloccherebbe la coda di sincronizzazione);
--  * se il sesso non è più female o l'utente non è maggiorenne, il Ciclo si
--    spegne (i dati restano, ma le policy li rendono inaccessibili finché
--    l'utente non sceglie se cancellarli).
create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_age int;
begin
  v_age := public.age_from_birth(new.birth_year, new.birth_month);
  if v_age is not null and v_age < 14 then
    raise exception 'Per usare l''app devi avere almeno 14 anni.' using errcode = 'P0001';
  end if;
  if v_age is not null and v_age < 18 then
    if new.goal = 'lose' then
      new.goal := 'maintain';
    end if;
    new.kcal_goal := null;
  end if;

  if new.sex is distinct from 'female' or coalesce(v_age, 0) < 18 then
    new.cycle_tracking_enabled := false;
  end if;
  return new;
end;
$$;

create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- Profilo creato alla registrazione. updated_at = -infinity: così il profilo
-- già compilato sul telefono prima dell'account "vince" al primo caricamento.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, updated_at) values (new.id, '-infinity');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Privilegi: il client NON può scrivere plan, cycle_tracking_enabled,
-- cycle_wiped_at, disclaimer_*, onboarding_completed_at, server_updated_at.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (
  display_name, sex, height_cm, birth_year, birth_month, activity_level, goal,
  kcal_goal, protein_goal_g, goals_source, goals_weight_kg, weight_unit, timezone, updated_at
) on table public.profiles to authenticated;

alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Peso: una riga per giorno (chiave = utente + giorno).
create table public.body_weights (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on       date not null check (measured_on >= '1900-01-01'),
  weight_kg         numeric(5, 2) not null check (weight_kg between 25 and 400),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, measured_on)
);

call public._setup_synced_table('body_weights', p_daily_limit => 2000);
grant insert (measured_on, weight_kg, created_at, updated_at, deleted_at) on table public.body_weights to authenticated;
grant update (weight_kg, updated_at, deleted_at) on table public.body_weights to authenticated;



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
